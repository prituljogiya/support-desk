import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { syncTicketOutbound } from "@/lib/freshdesk/sync";
import { PRIORITIES, STATUSES } from "@/lib/tickets";
import { isStaffRole } from "@/lib/features";
import { ASSIGNABLE_ROLES, hasPermission } from "@/lib/permissions";
import { computeSlaDueDates } from "@/lib/sla";
import type { MembershipRole } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

const ticketInclude = {
  requester: { select: { id: true, name: true, email: true } },
  assignee: { select: { id: true, name: true, email: true } },
  contact: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: {
        select: {
          id: true,
          name: true,
          contacts: { select: { email: true } },
        },
      },
    },
  },
  tags: { include: { tag: true } },
  messages: {
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" as const },
  },
};

async function getAccessibleTicket(
  id: string,
  organizationId: string,
  userId: string,
  role: MembershipRole,
  email: string,
) {
  const ticket = await prisma.ticket.findFirst({
    where: { id, organizationId },
    include: ticketInclude,
  });
  if (!ticket) return null;

  const isStaff = isStaffRole(role);
  if (isStaff) return ticket;

  if (ticket.requesterId === userId) {
    return {
      ...ticket,
      messages: ticket.messages.filter((m) => !m.isInternal),
    };
  }

  const companyOnly =
    hasPermission(role, "tickets.view_company") &&
    !hasPermission(role, "tickets.view");
  if (
    companyOnly &&
    ticket.contact?.company?.contacts.some((c) => c.email === email)
  ) {
    return {
      ...ticket,
      messages: ticket.messages.filter((m) => !m.isInternal),
    };
  }

  return null;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await requireOrgSession();
    const { id } = await params;
    const ticket = await getAccessibleTicket(
      id,
      session.user.organizationId,
      session.user.id,
      session.user.membershipRole,
      session.user.email!,
    );
    if (!ticket) return jsonError("Ticket not found", 404);
    return jsonOk({ ticket });
  } catch (err) {
    return handleApiError(err);
  }
}

const updateSchema = z.object({
  status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assigneeId: z.string().nullable().optional(),
  subject: z.string().min(1).max(200).optional(),
  tagIds: z.array(z.string()).optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await requireOrgSession();
    const { id } = await params;
    const isStaff = isStaffRole(session.user.membershipRole);
    if (!isStaff) return jsonError("Forbidden", 403);

    const existing = await prisma.ticket.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!existing) return jsonError("Ticket not found", 404);

    const body = updateSchema.parse(await req.json());
    if (body.status && !STATUSES.includes(body.status)) {
      return jsonError("Invalid status");
    }
    if (body.priority && !PRIORITIES.includes(body.priority)) {
      return jsonError("Invalid priority");
    }

    if (body.assigneeId) {
      const agent = await prisma.membership.findFirst({
        where: {
          organizationId: session.user.organizationId,
          userId: body.assigneeId,
          role: { in: ASSIGNABLE_ROLES },
        },
      });
      if (!agent) return jsonError("Assignee must be an org agent or admin");
    }

    let slaPatch: {
      firstResponseDueAt?: Date | null;
      resolutionDueAt?: Date | null;
    } = {};
    if (body.priority && body.priority !== existing.priority) {
      const sla = await computeSlaDueDates(
        session.user.organizationId,
        body.priority,
        existing.createdAt,
      );
      slaPatch = {
        firstResponseDueAt: existing.firstRespondedAt
          ? existing.firstResponseDueAt
          : sla.firstResponseDueAt,
        resolutionDueAt: existing.resolvedAt
          ? existing.resolutionDueAt
          : sla.resolutionDueAt,
      };
    }

    const resolvedAt =
      body.status === "resolved" || body.status === "closed"
        ? existing.resolvedAt ?? new Date()
        : body.status === "open" || body.status === "pending"
          ? null
          : undefined;

    if (body.tagIds) {
      await prisma.ticketTag.deleteMany({ where: { ticketId: id } });
      if (body.tagIds.length) {
        const validTags = await prisma.tag.findMany({
          where: {
            organizationId: session.user.organizationId,
            id: { in: body.tagIds },
          },
          select: { id: true },
        });
        await prisma.ticketTag.createMany({
          data: validTags.map((t) => ({ ticketId: id, tagId: t.id })),
        });
      }
    }

    await prisma.ticket.update({
      where: { id },
      data: {
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.priority !== undefined ? { priority: body.priority } : {}),
        ...(body.assigneeId !== undefined
          ? { assigneeId: body.assigneeId }
          : {}),
        ...(body.subject !== undefined ? { subject: body.subject } : {}),
        ...(resolvedAt !== undefined ? { resolvedAt } : {}),
        ...slaPatch,
        syncStatus: "pending",
      },
    });

    await syncTicketOutbound(id);

    if (
      body.assigneeId &&
      body.assigneeId !== existing.assigneeId
    ) {
      const { notifyUser } = await import("@/lib/automation");
      await notifyUser({
        organizationId: session.user.organizationId,
        userId: body.assigneeId,
        type: "ticket_assigned",
        title: "Ticket assigned to you",
        body: existing.subject,
        link: `/desk/tickets/${id}`,
      });
    }

    const refreshed = await getAccessibleTicket(
      id,
      session.user.organizationId,
      session.user.id,
      session.user.membershipRole,
      session.user.email!,
    );
    return jsonOk({ ticket: refreshed });
  } catch (err) {
    return handleApiError(err);
  }
}
