import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff, requireOrgAdmin, getOrgWithPlan } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { can } from "@/lib/features";

export async function GET() {
  try {
    const session = await requireStaff();
    const org = await getOrgWithPlan(session.user.organizationId);
    if (!org || !can(org, "savedViews")) {
      return jsonOk({ views: [] });
    }

    const views = await prisma.savedView.findMany({
      where: {
        organizationId: session.user.organizationId,
        OR: [{ isShared: true }, { userId: session.user.id }],
      },
      orderBy: { name: "asc" },
    });
    return jsonOk({ views });
  } catch (err) {
    return handleApiError(err);
  }
}

const schema = z.object({
  name: z.string().min(1).max(80),
  filters: z.record(z.string(), z.unknown()),
  isShared: z.boolean().optional().default(true),
});

export async function POST(req: Request) {
  try {
    const session = await requireStaff();
    const body = schema.parse(await req.json());
    const view = await prisma.savedView.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        name: body.name,
        filters: JSON.stringify(body.filters),
        isShared: body.isShared,
      },
    });
    return jsonOk({ view }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireOrgAdmin();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return jsonError("Missing id");
    const existing = await prisma.savedView.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!existing) return jsonError("Not found", 404);
    await prisma.savedView.delete({ where: { id } });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
