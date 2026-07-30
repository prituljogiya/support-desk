import { notFound, redirect } from "next/navigation";
import { auth, getOrgWithPlan } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TicketThread } from "@/components/ticket-thread";
import { can, isStaffRole } from "@/lib/features";
import { ASSIGNABLE_ROLES } from "@/lib/permissions";

type Props = { params: Promise<{ id: string }> };

export default async function DeskTicketPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");
  if (!isStaffRole(session.user.membershipRole)) redirect("/portal");

  const { id } = await params;
  const orgId = session.user.organizationId;

  const [ticket, agents, tags, org] = await Promise.all([
    prisma.ticket.findFirst({
      where: { id, organizationId: orgId },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            company: { select: { id: true, name: true } },
          },
        },
        tags: { include: { tag: true } },
        messages: {
          include: {
            author: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.membership.findMany({
      where: {
        organizationId: orgId,
        role: { in: ASSIGNABLE_ROLES },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.tag.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
    }),
    getOrgWithPlan(orgId),
  ]);

  if (!ticket) notFound();

  return (
    <TicketThread
      mode="desk"
      macrosEnabled={org ? can(org, "macros") : false}
      agents={agents.map((a) => ({
        id: a.user.id,
        name: a.user.name,
        email: a.user.email,
        role: a.role,
      }))}
      allTags={tags}
      ticket={{
        id: ticket.id,
        subject: ticket.subject,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        syncStatus: ticket.syncStatus,
        syncError: ticket.syncError,
        freshdeskId: ticket.freshdeskId,
        firstResponseDueAt: ticket.firstResponseDueAt?.toISOString() ?? null,
        resolutionDueAt: ticket.resolutionDueAt?.toISOString() ?? null,
        requester: ticket.requester,
        assignee: ticket.assignee,
        contact: ticket.contact,
        tags: ticket.tags,
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
  );
}
