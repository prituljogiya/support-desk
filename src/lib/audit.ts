import { prisma } from "@/lib/prisma";

export async function writeAuditLog(input: {
  action: string;
  actorUserId?: string | null;
  organizationId?: string | null;
  impersonatedUserId?: string | null;
  meta?: Record<string, unknown>;
}) {
  return prisma.auditLog.create({
    data: {
      action: input.action,
      actorUserId: input.actorUserId ?? null,
      organizationId: input.organizationId ?? null,
      impersonatedUserId: input.impersonatedUserId ?? null,
      meta: JSON.stringify(input.meta ?? {}),
    },
  });
}
