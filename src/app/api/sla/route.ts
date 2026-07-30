import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff, requireOrgAdmin, getOrgWithPlan } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { can } from "@/lib/features";

export async function GET() {
  try {
    const session = await requireStaff();
    const org = await getOrgWithPlan(session.user.organizationId);
    if (!org || !can(org, "sla")) {
      return jsonOk({ policies: [], businessHours: null, gated: true });
    }

    const [policies, businessHours] = await Promise.all([
      prisma.slaPolicy.findMany({
        where: { organizationId: session.user.organizationId },
        orderBy: { name: "asc" },
      }),
      prisma.businessHours.findUnique({
        where: { organizationId: session.user.organizationId },
      }),
    ]);

    return jsonOk({ policies, businessHours, gated: false });
  } catch (err) {
    return handleApiError(err);
  }
}

const schema = z.object({
  name: z.string().min(1).max(80),
  priority: z
    .enum(["low", "medium", "high", "urgent"])
    .nullable()
    .optional(),
  firstResponseMinutes: z.number().int().positive().max(60 * 24 * 30),
  resolutionMinutes: z.number().int().positive().max(60 * 24 * 90),
  isDefault: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  try {
    const session = await requireOrgAdmin();
    const org = await getOrgWithPlan(session.user.organizationId);
    if (!org || !can(org, "sla")) {
      return jsonError("SLA requires Pro plan or higher", 402);
    }

    const body = schema.parse(await req.json());
    if (body.isDefault) {
      await prisma.slaPolicy.updateMany({
        where: { organizationId: session.user.organizationId },
        data: { isDefault: false },
      });
    }

    const policy = await prisma.slaPolicy.create({
      data: {
        organizationId: session.user.organizationId,
        name: body.name,
        priority: body.priority ?? null,
        firstResponseMinutes: body.firstResponseMinutes,
        resolutionMinutes: body.resolutionMinutes,
        isDefault: body.isDefault,
      },
    });
    return jsonOk({ policy }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireOrgAdmin();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return jsonError("Missing id");
    const existing = await prisma.slaPolicy.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!existing) return jsonError("Not found", 404);
    await prisma.slaPolicy.delete({ where: { id } });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
