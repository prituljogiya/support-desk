import { z } from "zod";
import { MembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { INVITABLE_ROLES, ROLE_LABELS } from "@/lib/permissions";

export async function GET() {
  try {
    const session = await requirePermission("users.view", "users.assign_roles");
    const memberships = await prisma.membership.findMany({
      where: { organizationId: session.user.organizationId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return jsonOk({
      members: memberships.map((m) => ({
        id: m.id,
        role: m.role,
        roleLabel: ROLE_LABELS[m.role],
        disabled: m.disabled,
        user: m.user,
      })),
      roles: INVITABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

const patchSchema = z.object({
  membershipId: z.string().min(1),
  role: z.nativeEnum(MembershipRole).optional(),
  disabled: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  try {
    const session = await requirePermission("users.assign_roles", "users.disable");
    const body = patchSchema.parse(await req.json());
    const membership = await prisma.membership.findFirst({
      where: {
        id: body.membershipId,
        organizationId: session.user.organizationId,
      },
    });
    if (!membership) return jsonError("Member not found", 404);
    if (membership.role === "owner" && body.role && body.role !== "owner") {
      return jsonError("Cannot change owner role", 403);
    }
    if (body.role === "admin" && session.user.membershipRole !== "owner") {
      return jsonError("Only owners can assign admin", 403);
    }

    const updated = await prisma.membership.update({
      where: { id: membership.id },
      data: {
        ...(body.role ? { role: body.role } : {}),
        ...(body.disabled !== undefined ? { disabled: body.disabled } : {}),
      },
      include: { user: { select: { email: true, name: true } } },
    });

    await writeAuditLog({
      action: "member.update",
      actorUserId: session.user.id,
      organizationId: session.user.organizationId,
      meta: body,
    });

    return jsonOk({ member: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
