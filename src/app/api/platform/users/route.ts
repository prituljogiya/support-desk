import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import type { MembershipRole } from "@prisma/client";

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(6).max(100),
  isSuperAdmin: z.boolean().optional(),
  organizationId: z.string().optional(),
  role: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSuperAdmin();
    const body = createSchema.parse(await req.json());
    const email = body.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return jsonError("User already exists", 409);

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        name: body.name,
        passwordHash,
        isSuperAdmin: body.isSuperAdmin ?? false,
      },
    });

    if (body.organizationId && body.role) {
      await prisma.membership.create({
        data: {
          userId: user.id,
          organizationId: body.organizationId,
          role: body.role as MembershipRole,
        },
      });
    }

    await writeAuditLog({
      action: "user.create",
      actorUserId: session.user.id,
      organizationId: body.organizationId,
      meta: { email, role: body.role },
    });

    return jsonOk({ user: { id: user.id, email: user.email, name: user.name } }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

const patchSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1).max(120).optional(),
  password: z.string().min(6).max(100).optional(),
  isSuperAdmin: z.boolean().optional(),
  membershipId: z.string().optional(),
  role: z.string().optional(),
  disabled: z.boolean().optional(),
  deleteMembership: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  try {
    const session = await requireSuperAdmin();
    const body = patchSchema.parse(await req.json());

    if (body.password || body.name !== undefined || body.isSuperAdmin !== undefined) {
      await prisma.user.update({
        where: { id: body.userId },
        data: {
          ...(body.name ? { name: body.name } : {}),
          ...(body.password
            ? { passwordHash: await bcrypt.hash(body.password, 10) }
            : {}),
          ...(body.isSuperAdmin !== undefined
            ? { isSuperAdmin: body.isSuperAdmin }
            : {}),
        },
      });
    }

    if (body.membershipId) {
      if (body.deleteMembership) {
        await prisma.membership.delete({ where: { id: body.membershipId } });
      } else {
        await prisma.membership.update({
          where: { id: body.membershipId },
          data: {
            ...(body.role ? { role: body.role as MembershipRole } : {}),
            ...(body.disabled !== undefined ? { disabled: body.disabled } : {}),
          },
        });
      }
    }

    await writeAuditLog({
      action: "user.update",
      actorUserId: session.user.id,
      meta: body,
    });

    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

const deleteSchema = z.object({ userId: z.string().min(1) });

export async function DELETE(req: Request) {
  try {
    const session = await requireSuperAdmin();
    const body = deleteSchema.parse(await req.json());
    if (body.userId === session.user.id) {
      return jsonError("Cannot delete yourself", 400);
    }
    await prisma.user.delete({ where: { id: body.userId } });
    await writeAuditLog({
      action: "user.delete",
      actorUserId: session.user.id,
      meta: { userId: body.userId },
    });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
