import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import {
  DEFAULT_FEATURES,
  FEATURE_LABELS,
  parsePlanFeatures,
  slugify,
  type FeatureKey,
  type PlanFeatures,
} from "@/lib/features";

export async function GET() {
  try {
    await requireSuperAdmin();
    const plans = await prisma.plan.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { organizations: true } } },
    });
    return jsonOk({
      plans: plans.map((p) => ({
        ...p,
        features: parsePlanFeatures(p.features),
        tenantCount: p._count.organizations,
      })),
      featureKeys: Object.keys(DEFAULT_FEATURES) as FeatureKey[],
      featureLabels: FEATURE_LABELS,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

const planSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "key must be lowercase alphanumeric/dashes"),
  name: z.string().min(2).max(80),
  description: z.string().max(500).nullable().optional(),
  seatLimit: z.number().int().min(1).max(100000),
  sortOrder: z.number().int().min(0).max(999).optional(),
  monthlyPriceCents: z.number().int().min(0).optional(),
  yearlyPriceCents: z.number().int().min(0).optional(),
  trialDays: z.number().int().min(0).max(365).optional(),
  active: z.boolean().optional(),
  features: z.record(z.string(), z.boolean()).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSuperAdmin();
    const body = planSchema.parse(await req.json());
    const key = body.key || slugify(body.name);

    const existing = await prisma.plan.findUnique({ where: { key } });
    if (existing) return jsonError("Plan key already exists", 409);

    const maxSort = await prisma.plan.aggregate({ _max: { sortOrder: true } });
    const features = {
      ...DEFAULT_FEATURES,
      ...(body.features || {}),
    } as PlanFeatures;

    const plan = await prisma.plan.create({
      data: {
        key,
        name: body.name,
        description: body.description ?? null,
        seatLimit: body.seatLimit,
        sortOrder: body.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
        monthlyPriceCents: body.monthlyPriceCents ?? 0,
        yearlyPriceCents: body.yearlyPriceCents ?? 0,
        trialDays: body.trialDays ?? 0,
        active: body.active ?? true,
        features: JSON.stringify(features),
      },
    });

    await writeAuditLog({
      action: "plan.create",
      actorUserId: session.user.id,
      meta: { key: plan.key, name: plan.name },
    });

    return jsonOk(
      { plan: { ...plan, features: parsePlanFeatures(plan.features) } },
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}

const patchSchema = planSchema.partial().extend({
  id: z.string().min(1),
  key: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

export async function PATCH(req: Request) {
  try {
    const session = await requireSuperAdmin();
    const body = patchSchema.parse(await req.json());
    const current = await prisma.plan.findUnique({ where: { id: body.id } });
    if (!current) return jsonError("Plan not found", 404);

    if (body.key && body.key !== current.key) {
      const clash = await prisma.plan.findUnique({ where: { key: body.key } });
      if (clash) return jsonError("Plan key already exists", 409);
    }

    let featuresJson: string | undefined;
    if (body.features) {
      const existing = parsePlanFeatures(current.features);
      featuresJson = JSON.stringify({ ...existing, ...body.features });
    }

    const plan = await prisma.plan.update({
      where: { id: body.id },
      data: {
        ...(body.key !== undefined ? { key: body.key } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
        ...(body.seatLimit !== undefined ? { seatLimit: body.seatLimit } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        ...(body.monthlyPriceCents !== undefined
          ? { monthlyPriceCents: body.monthlyPriceCents }
          : {}),
        ...(body.yearlyPriceCents !== undefined
          ? { yearlyPriceCents: body.yearlyPriceCents }
          : {}),
        ...(body.trialDays !== undefined ? { trialDays: body.trialDays } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(featuresJson ? { features: featuresJson } : {}),
      },
      include: { _count: { select: { organizations: true } } },
    });

    await writeAuditLog({
      action: "plan.update",
      actorUserId: session.user.id,
      meta: { id: plan.id, key: plan.key },
    });

    return jsonOk({
      plan: {
        ...plan,
        features: parsePlanFeatures(plan.features),
        tenantCount: plan._count.organizations,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

const deleteSchema = z.object({
  id: z.string().min(1),
  reassignToPlanKey: z.string().min(1).optional(),
});

export async function DELETE(req: Request) {
  try {
    const session = await requireSuperAdmin();
    const body = deleteSchema.parse(await req.json());
    const plan = await prisma.plan.findUnique({
      where: { id: body.id },
      include: { _count: { select: { organizations: true } } },
    });
    if (!plan) return jsonError("Plan not found", 404);

    if (plan._count.organizations > 0) {
      if (!body.reassignToPlanKey) {
        return jsonError(
          "Plan has tenants. Provide reassignToPlanKey to move them first.",
          400,
        );
      }
      const target = await prisma.plan.findUnique({
        where: { key: body.reassignToPlanKey },
      });
      if (!target || target.id === plan.id) {
        return jsonError("Invalid reassignment plan", 400);
      }
      await prisma.organization.updateMany({
        where: { planId: plan.id },
        data: { planId: target.id },
      });
    }

    await prisma.plan.delete({ where: { id: plan.id } });
    await writeAuditLog({
      action: "plan.delete",
      actorUserId: session.user.id,
      meta: {
        key: plan.key,
        reassignedTo: body.reassignToPlanKey || null,
      },
    });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
