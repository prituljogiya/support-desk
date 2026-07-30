import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff, getOrgWithPlan } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { can } from "@/lib/features";
import { syncMessageOutbound, syncTicketOutbound } from "@/lib/freshdesk/sync";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  macroId: z.string().min(1),
});

type MacroActions = {
  status?: "open" | "pending" | "resolved" | "closed" | null;
  priority?: "low" | "medium" | "high" | "urgent" | null;
  assigneeId?: string | null;
  addTagIds?: string[];
  reply?: string | null;
  internalNote?: string | null;
};

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await requireStaff();
    const org = await getOrgWithPlan(session.user.organizationId);
    if (!org || !can(org, "macros")) {
      return jsonError("Macros require Pro plan or higher", 402);
    }

    const { id } = await params;
    const body = schema.parse(await req.json());

    const ticket = await prisma.ticket.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!ticket) return jsonError("Ticket not found", 404);

    const macro = await prisma.macro.findFirst({
      where: { id: body.macroId, organizationId: session.user.organizationId },
    });
    if (!macro) return jsonError("Macro not found", 404);

    let actions: MacroActions = {};
    try {
      actions = JSON.parse(macro.actions) as MacroActions;
    } catch {
      return jsonError("Invalid macro actions", 500);
    }

    if (actions.addTagIds?.length) {
      for (const tagId of actions.addTagIds) {
        const tag = await prisma.tag.findFirst({
          where: { id: tagId, organizationId: session.user.organizationId },
        });
        if (!tag) continue;
        await prisma.ticketTag.upsert({
          where: { ticketId_tagId: { ticketId: id, tagId } },
          update: {},
          create: { ticketId: id, tagId },
        });
      }
    }

    const resolvedAt =
      actions.status === "resolved" || actions.status === "closed"
        ? ticket.resolvedAt ?? new Date()
        : undefined;

    await prisma.ticket.update({
      where: { id },
      data: {
        ...(actions.status ? { status: actions.status } : {}),
        ...(actions.priority ? { priority: actions.priority } : {}),
        ...(actions.assigneeId !== undefined
          ? { assigneeId: actions.assigneeId }
          : {}),
        ...(resolvedAt ? { resolvedAt } : {}),
        syncStatus: "pending",
      },
    });

    if (actions.reply?.trim()) {
      const msg = await prisma.message.create({
        data: {
          ticketId: id,
          authorId: session.user.id,
          body: actions.reply.trim(),
          isInternal: false,
          syncStatus: "pending",
        },
      });
      if (!ticket.firstRespondedAt) {
        await prisma.ticket.update({
          where: { id },
          data: { firstRespondedAt: new Date() },
        });
      }
      await syncMessageOutbound(msg.id);
    }

    if (actions.internalNote?.trim()) {
      const note = await prisma.message.create({
        data: {
          ticketId: id,
          authorId: session.user.id,
          body: actions.internalNote.trim(),
          isInternal: true,
          syncStatus: "pending",
        },
      });
      await syncMessageOutbound(note.id);
    }

    await syncTicketOutbound(id);

    const refreshed = await prisma.ticket.findFirst({
      where: { id, organizationId: session.user.organizationId },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        contact: { select: { id: true, name: true, email: true, phone: true } },
        tags: { include: { tag: true } },
        messages: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return jsonOk({ ticket: refreshed, macro: { id: macro.id, name: macro.name } });
  } catch (err) {
    return handleApiError(err);
  }
}

