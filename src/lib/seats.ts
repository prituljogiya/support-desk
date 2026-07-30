import { prisma } from "@/lib/prisma";
import { isSeatRole } from "@/lib/permissions";
import type { MembershipRole } from "@prisma/client";

export async function getSeatUsage(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      plan: { select: { seatLimit: true, name: true } },
      memberships: { where: { disabled: false }, select: { role: true } },
    },
  });
  if (!org) return null;

  const used = org.memberships.filter((m) => isSeatRole(m.role)).length;
  const pendingInvites = await prisma.invite.count({
    where: {
      organizationId,
      status: "pending",
      expiresAt: { gt: new Date() },
      role: {
        in: [
          "owner",
          "admin",
          "manager",
          "supervisor",
          "agent",
          "junior_agent",
          "qa",
          "kb_editor",
          "ai_manager",
          "developer",
          "auditor",
          "billing_manager",
        ] as MembershipRole[],
      },
    },
  });

  return {
    used,
    pendingInvites,
    reserved: used + pendingInvites,
    limit: org.plan.seatLimit,
    planName: org.plan.name,
    remaining: Math.max(0, org.plan.seatLimit - used - pendingInvites),
  };
}

export function roleCountsAsSeat(role: MembershipRole) {
  return isSeatRole(role);
}
