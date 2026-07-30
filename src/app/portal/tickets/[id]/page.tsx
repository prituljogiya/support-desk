import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TicketThread } from "@/components/ticket-thread";
import { isPortalRole } from "@/lib/features";
import { canAccessPortalTicket } from "@/lib/portal-access";
import { StatusBadge, PriorityBadge } from "@/components/shell";

type Props = { params: Promise<{ id: string }> };

export default async function PortalTicketPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");
  if (!isPortalRole(session.user.membershipRole)) redirect("/desk");

  const { id } = await params;
  const accessible = await canAccessPortalTicket({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    email: session.user.email!,
    role: session.user.membershipRole!,
    ticketId: id,
  });
  if (!accessible) notFound();

  const ticket = await prisma.ticket.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      requester: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
      messages: {
        where: { isInternal: false },
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket) notFound();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <StatusBadge status={ticket.status} />
        <PriorityBadge priority={ticket.priority} />
        <span className="text-xs text-slate-500">
          Opened {ticket.createdAt.toLocaleString()}
          {ticket.assignee
            ? ` · Assigned to ${ticket.assignee.name || ticket.assignee.email}`
            : " · Awaiting assignment"}
        </span>
      </div>
      <TicketThread
        mode="portal"
        ticket={{
          id: ticket.id,
          subject: ticket.subject,
          description: ticket.description,
          status: ticket.status,
          priority: ticket.priority,
        channel: ticket.channel,
          syncStatus: ticket.syncStatus,
          syncError: ticket.syncError,
          freshdeskId: ticket.freshdeskId,
          requester: ticket.requester,
          assignee: ticket.assignee,
          messages: ticket.messages.map((m) => ({
            id: m.id,
            body: m.body,
            isInternal: m.isInternal,
            syncStatus: m.syncStatus,
            syncError: m.syncError,
            createdAt: m.createdAt.toISOString(),
            author: m.author,
          })),
        }}
      />
    </div>
  );
}
