import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { syncTicketOutbound } from "@/lib/freshdesk/sync";
import { PRIORITIES } from "@/lib/tickets";
import { isStaffRole } from "@/lib/features";
import { hasPermission } from "@/lib/permissions";
import { computeSlaDueDates } from "@/lib/sla";
import { runTicketAutomations } from "@/lib/automation";

const createSchema = z.object({
  subject: z.string().min(1).max(200),
  description: z.string().min(1).max(10000),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
});

export async function GET(req: Request) {
  try {
    const session = await requireOrgSession();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const assigneeId = searchParams.get("assigneeId");
    const tagId = searchParams.get("tagId");
    const q = searchParams.get("q");

    const role = session.user.membershipRole;
    const isStaff = isStaffRole(role);
    const orgId = session.user.organizationId;
    const assignedOnly =
      hasPermission(role, "tickets.view_assigned") &&
      !hasPermission(role, "tickets.view") &&
      !hasPermission(role, "tickets.view_team");
    const companyOnly =
      hasPermission(role, "tickets.view_company") &&
      !hasPermission(role, "tickets.view");

    const tickets = await prisma.ticket.findMany({
      where: {
        organizationId: orgId,
        ...(isStaff
          ? assignedOnly
            ? { assigneeId: session.user.id }
            : {}
          : companyOnly
            ? {
                contact: {
                  company: {
                    contacts: {
                      some: { email: session.user.email },
                    },
                  },
                },
              }
            : { requesterId: session.user.id }),
        ...(status ? { status: status as never } : {}),
        ...(priority && PRIORITIES.includes(priority as never)
          ? { priority: priority as never }
          : {}),
        ...(isStaff && assigneeId
          ? assigneeId === "unassigned"
            ? { assigneeId: null }
            : { assigneeId }
          : {}),
        ...(tagId ? { tags: { some: { tagId } } } : {}),
        ...(q
          ? {
              OR: [
                { subject: { contains: q } },
                { description: { contains: q } },
              ],
            }
          : {}),
      },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        contact: { select: { id: true, name: true, email: true, phone: true } },
        tags: { include: { tag: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return jsonOk({ tickets });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireOrgSession();
    const body = createSchema.parse(await req.json());
    const orgId = session.user.organizationId;

    const sla = await computeSlaDueDates(orgId, body.priority);

    let contact = await prisma.contact.findUnique({
      where: {
        organizationId_email: {
          organizationId: orgId,
          email: session.user.email,
        },
      },
    });
    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          organizationId: orgId,
          name: session.user.name,
          email: session.user.email,
          createdById: session.user.id,
        },
      });
    }

    const ticket = await prisma.ticket.create({
      data: {
        organizationId: orgId,
        subject: body.subject,
        description: body.description,
        priority: body.priority,
        requesterId: session.user.id,
        contactId: contact.id,
        syncStatus: "pending",
        channel: "portal",
        department: "general",
        firstResponseDueAt: sla.firstResponseDueAt,
        resolutionDueAt: sla.resolutionDueAt,
        messages: {
          create: {
            authorId: session.user.id,
            body: body.description,
            isInternal: false,
            syncStatus: "pending",
          },
        },
      },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        messages: true,
        tags: { include: { tag: true } },
      },
    });

    await runTicketAutomations({
      organizationId: orgId,
      ticketId: ticket.id,
      subject: ticket.subject,
      description: ticket.description,
      priority: ticket.priority,
    });

    await syncTicketOutbound(ticket.id);
    const firstMessage = ticket.messages[0];
    if (firstMessage) {
      const { syncMessageOutbound } = await import("@/lib/freshdesk/sync");
      await syncMessageOutbound(firstMessage.id);
    }

    const refreshed = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        contact: { select: { id: true, name: true, email: true, phone: true } },
        tags: { include: { tag: true } },
        messages: {
          include: {
            author: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return jsonOk({ ticket: refreshed }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
