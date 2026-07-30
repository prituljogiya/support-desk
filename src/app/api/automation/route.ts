import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff, requireOrgAdmin, getOrgWithPlan } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { can } from "@/lib/features";

export async function GET() {
  try {
    const session = await requireStaff();
    const org = await getOrgWithPlan(session.user.organizationId);
    if (!org || !can(org, "automation")) {
      return jsonOk({ rules: [], gated: true });
    }
    const rules = await prisma.automationRule.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { createdAt: "desc" },
    });
    return jsonOk({ rules, gated: false });
  } catch (err) {
    return handleApiError(err);
  }
}

const schema = z.object({
  name: z.string().min(1).max(120),
  enabled: z.boolean().optional().default(true),
  match: z.object({
    keywords: z.array(z.string()).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  }),
  actions: z.object({
    assigneeId: z.string().nullable().optional(),
    addTagIds: z.array(z.string()).optional(),
    setPriority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  }),
});

export async function POST(req: Request) {
  try {
    const session = await requireOrgAdmin();
    const org = await getOrgWithPlan(session.user.organizationId);
    if (!org || !can(org, "automation")) {
      return jsonError("Automation requires Pro plan or higher", 402);
    }
    const body = schema.parse(await req.json());
    const rule = await prisma.automationRule.create({
      data: {
        organizationId: session.user.organizationId,
        name: body.name,
        enabled: body.enabled,
        match: JSON.stringify(body.match),
        actions: JSON.stringify(body.actions),
      },
    });
    return jsonOk({ rule }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireOrgAdmin();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return jsonError("Missing id");
    const existing = await prisma.automationRule.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!existing) return jsonError("Not found", 404);
    await prisma.automationRule.delete({ where: { id } });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
