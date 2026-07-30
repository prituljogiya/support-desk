import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { isPortalRole } from "@/lib/features";

const schema = z.object({
  name: z.string().min(1).max(100),
  currentPassword: z.string().min(6).max(100).optional(),
  newPassword: z.string().min(6).max(100).optional(),
});

export async function PATCH(req: Request) {
  try {
    const session = await requireOrgSession();
    if (!isPortalRole(session.user.membershipRole)) {
      return jsonError("Portal profile only", 403);
    }

    const body = schema.parse(await req.json());

    if (body.newPassword) {
      if (!body.currentPassword) {
        return jsonError("Current password required", 400);
      }
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
      });
      if (!user?.passwordHash) return jsonError("Account cannot change password", 400);
      const ok = await bcrypt.compare(body.currentPassword, user.passwordHash);
      if (!ok) return jsonError("Current password is incorrect", 400);
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: body.name,
        ...(body.newPassword
          ? { passwordHash: await bcrypt.hash(body.newPassword, 10) }
          : {}),
      },
      select: { id: true, name: true, email: true },
    });

    return jsonOk({ user: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
