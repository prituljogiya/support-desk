import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";

const schema = z.object({
  organizationId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const body = schema.parse(await req.json());
    const membership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: body.organizationId,
        },
      },
      include: {
        organization: {
          select: { id: true, name: true, slug: true, disabled: true },
        },
      },
    });

    if (!membership || membership.organization.disabled) {
      return jsonError("Organization not found", 404);
    }

    return jsonOk({
      organizationId: membership.organizationId,
      membershipRole: membership.role,
      organizationName: membership.organization.name,
      organizationSlug: membership.organization.slug,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET() {
  try {
    const session = await requireSession();
    const memberships = await prisma.membership.findMany({
      where: {
        userId: session.user.id,
        organization: { disabled: false },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: { select: { key: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return jsonOk({
      memberships: memberships.map((m) => ({
        organizationId: m.organizationId,
        role: m.role,
        organization: m.organization,
      })),
      activeOrganizationId: session.user.organizationId,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
