import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { STATUSES, PRIORITIES } from "@/lib/tickets";
import { syncTicketOutbound } from "@/lib/freshdesk/sync";
import { notifyUser } from "@/lib/automation";
import { ASSIGNABLE_ROLES } from "@/lib/permissions";

const schema = z.object({
  ticketIds: z.array(z.string()).min(1).max(50),
  status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assigneeId: z.string().nullable().optional(),
  addTagIds: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireStaff();
    const body = schema.parse(await req.json());
    const orgId = session.user.organizationId;

    if (body.status && !STATUSES.includes(body.status)) {
      return jsonError("Invalid status");
    }
    if (body.priority && !PRIORITIES.includes(body.priority)) {
      return jsonError("Invalid priority");
    }

    if (body.assigneeId) {
      const member = await prisma.membership.findFirst({
        where: {
          organizationId: orgId,
          userId: body.assigneeId,
          role: { in: ASSIGNABLE_ROLES },
        },
      });
      if (!member) return jsonError("Invalid assignee");
    }

    const tickets = await prisma.ticket.findMany({
      where: { organizationId: orgId, id: { in: body.ticketIds } },
      select: { id: true, subject: true, assigneeId: true },
    });

    for (const t of tickets) {
      await prisma.ticket.update({
        where: { id: t.id },
        data: {
          ...(body.status ? { status: body.status } : {}),
          ...(body.priority ? { priority: body.priority } : {}),
          ...(body.assigneeId !== undefined
            ? { assigneeId: body.assigneeId }
            : {}),
          ...(body.status === "resolved" || body.status === "closed"
            ? { resolvedAt: new Date() }
            : {}),
          syncStatus: "pending",
        },
      });

      if (body.addTagIds?.length) {
        for (const tagId of body.addTagIds) {
          const tag = await prisma.tag.findFirst({
            where: { id: tagId, organizationId: orgId },
          });
          if (!tag) continue;
          await prisma.ticketTag.upsert({
            where: { ticketId_tagId: { ticketId: t.id, tagId } },
            update: {},
            create: { ticketId: t.id, tagId },
          });
        }
      }

      if (body.assigneeId && body.assigneeId !== t.assigneeId) {
        await notifyUser({
          organizationId: orgId,
          userId: body.assigneeId,
          type: "ticket_assigned",
          title: "Ticket assigned to you",
          body: t.subject,
          link: `/desk/tickets/${t.id}`,
        });
      }

      await syncTicketOutbound(t.id);
    }

    return jsonOk({ updated: tickets.length });
  } catch (err) {
    return handleApiError(err);
  }
}
