import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import bcrypt from "bcryptjs";

const schema = z.object({
  userId: z.string().min(1),
  organizationId: z.string().optional(),
  temporaryPassword: z.string().min(6).max(100).default("password123"),
});

/**
 * Super-admin "impersonate": reset a temporary password and log the action.
 * Full cookie-swap impersonation is deferred; this gives controlled access.
 */
export async function POST(req: Request) {
  try {
    const session = await requireSuperAdmin();
    const body = schema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { id: body.userId } });
    if (!user) return jsonError("User not found", 404);

    const passwordHash = await bcrypt.hash(body.temporaryPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await writeAuditLog({
      action: "user.impersonate_grant",
      actorUserId: session.user.id,
      organizationId: body.organizationId,
      impersonatedUserId: user.id,
      meta: { email: user.email },
    });

    return jsonOk({
      ok: true,
      email: user.email,
      temporaryPassword: body.temporaryPassword,
      loginUrl: "/login",
      message:
        "Temporary password set. Sign out, then sign in as this user. Rotate the password after.",
    });
  } catch (err) {
    return handleApiError(err);
  }
}
