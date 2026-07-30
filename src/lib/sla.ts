import type { TicketPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function resolveSlaPolicy(
  organizationId: string,
  priority: TicketPriority,
) {
  const priorityPolicy = await prisma.slaPolicy.findFirst({
    where: { organizationId, priority },
  });
  if (priorityPolicy) return priorityPolicy;

  return prisma.slaPolicy.findFirst({
    where: { organizationId, isDefault: true },
  });
}

export function addMinutes(from: Date, minutes: number) {
  return new Date(from.getTime() + minutes * 60 * 1000);
}

export async function computeSlaDueDates(
  organizationId: string,
  priority: TicketPriority,
  from = new Date(),
) {
  const policy = await resolveSlaPolicy(organizationId, priority);
  if (!policy) {
    return { firstResponseDueAt: null, resolutionDueAt: null, policy: null };
  }
  return {
    firstResponseDueAt: addMinutes(from, policy.firstResponseMinutes),
    resolutionDueAt: addMinutes(from, policy.resolutionMinutes),
    policy,
  };
}

export { slaChip } from "@/lib/sla-ui";
