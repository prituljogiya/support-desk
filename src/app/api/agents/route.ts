import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { ASSIGNABLE_ROLES } from "@/lib/permissions";

export async function GET() {
  try {
    const session = await requireStaff();
    const agents = await prisma.membership.findMany({
      where: {
        organizationId: session.user.organizationId,
        role: { in: ASSIGNABLE_ROLES },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return jsonOk({
      agents: agents.map((a) => ({
        id: a.user.id,
        name: a.user.name,
        email: a.user.email,
        role: a.role,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
