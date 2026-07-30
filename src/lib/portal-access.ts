import { prisma } from "@/lib/prisma";
import { hasPermission, type Permission } from "@/lib/permissions";
import type { MembershipRole, TicketStatus } from "@prisma/client";

/** Prisma where-clause for tickets a portal user may list. */
export function portalTicketListWhere(
  organizationId: string,
  userId: string,
  email: string,
  role: MembershipRole,
  status?: TicketStatus | "all" | null,
) {
  const companyOnly =
    hasPermission(role, "tickets.view_company") &&
    !hasPermission(role, "tickets.view");

  const statusFilter =
    status && status !== "all" ? { status } : {};

  return {
    organizationId,
    ...statusFilter,
    ...(companyOnly
      ? {
          OR: [
            { requesterId: userId },
            {
              contact: {
                company: {
                  contacts: { some: { email } },
                },
              },
            },
          ],
        }
      : { requesterId: userId }),
  };
}

/** Whether a portal user can open a specific ticket. */
export async function canAccessPortalTicket(opts: {
  organizationId: string;
  userId: string;
  email: string;
  role: MembershipRole;
  ticketId: string;
}) {
  const ticket = await prisma.ticket.findFirst({
    where: { id: opts.ticketId, organizationId: opts.organizationId },
    include: {
      contact: {
        select: {
          email: true,
          company: {
            select: {
              contacts: { select: { email: true } },
            },
          },
        },
      },
    },
  });
  if (!ticket) return null;

  if (ticket.requesterId === opts.userId) return ticket;

  const companyOnly =
    hasPermission(opts.role, "tickets.view_company" as Permission) &&
    !hasPermission(opts.role, "tickets.view" as Permission);

  if (companyOnly && ticket.contact?.company) {
    const emails = ticket.contact.company.contacts.map((c) => c.email);
    if (emails.includes(opts.email)) return ticket;
  }

  return null;
}

export const PORTAL_STATUS_TABS: {
  key: TicketStatus | "all";
  label: string;
}[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "pending", label: "Pending" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" },
];
