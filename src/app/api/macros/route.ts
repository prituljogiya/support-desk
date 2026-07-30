import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff, requireOrgAdmin, getOrgWithPlan } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { can } from "@/lib/features";

export async function GET() {
  try {
    const session = await requireStaff();
    const org = await getOrgWithPlan(session.user.organizationId);
    if (!org || !can(org, "macros")) {
      return jsonOk({ macros: [], gated: true });
    }

    const macros = await prisma.macro.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { name: "asc" },
    });
    return jsonOk({ macros, gated: false });
  } catch (err) {
    return handleApiError(err);
  }
}

const schema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  actions: z.object({
    status: z.enum(["open", "pending", "resolved", "closed"]).optional().nullable(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional().nullable(),
    assigneeId: z.string().nullable().optional(),
    addTagIds: z.array(z.string()).optional(),
    reply: z.string().max(10000).optional().nullable(),
    internalNote: z.string().max(10000).optional().nullable(),
  }),
});

export async function POST(req: Request) {
  try {
    const session = await requireOrgAdmin();
    const org = await getOrgWithPlan(session.user.organizationId);
    if (!org || !can(org, "macros")) {
      return jsonError("Macros require Pro plan or higher", 402);
    }

    const body = schema.parse(await req.json());
    const macro = await prisma.macro.create({
      data: {
        organizationId: session.user.organizationId,
        name: body.name,
        description: body.description ?? null,
        actions: JSON.stringify(body.actions),
        createdById: session.user.id,
      },
    });
    return jsonOk({ macro }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireOrgAdmin();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return jsonError("Missing id");
    const existing = await prisma.macro.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!existing) return jsonError("Not found", 404);
    await prisma.macro.delete({ where: { id } });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
