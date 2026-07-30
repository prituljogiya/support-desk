import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import {
  buildBillingDashboard,
  buildFeatureManagement,
  buildPlatformAnalytics,
  buildPlatformHealth,
  buildRevenueDashboard,
} from "@/lib/platform-dashboards";
import {
  DEFAULT_FEATURES,
  type FeatureKey,
  type PlanFeatures,
} from "@/lib/features";

export async function GET(req: Request) {
  try {
    await requireSuperAdmin();
    const panel = new URL(req.url).searchParams.get("panel") || "all";

    if (panel === "revenue") return jsonOk(await buildRevenueDashboard());
    if (panel === "health") return jsonOk(await buildPlatformHealth());
    if (panel === "billing") return jsonOk(await buildBillingDashboard());
    if (panel === "analytics") return jsonOk(await buildPlatformAnalytics());
    if (panel === "features") return jsonOk(await buildFeatureManagement());

    const [revenue, health, billing, analytics, features] = await Promise.all([
      buildRevenueDashboard(),
      buildPlatformHealth(),
      buildBillingDashboard(),
      buildPlatformAnalytics(),
      buildFeatureManagement(),
    ]);
    return jsonOk({ revenue, health, billing, analytics, features });
  } catch (err) {
    return handleApiError(err);
  }
}

const featurePatch = z.object({
  scope: z.enum(["global", "plan"]),
  planKey: z.string().optional(),
  features: z.record(z.string(), z.boolean()),
});

export async function PATCH(req: Request) {
  try {
    const session = await requireSuperAdmin();
    const body = featurePatch.parse(await req.json());

    if (body.scope === "global") {
      const current = await prisma.platformSetting.upsert({
        where: { id: "default" },
        update: {},
        create: { id: "default" },
      });
      let existing: Partial<PlanFeatures> = {};
      try {
        existing = JSON.parse(current.featuresJson || "{}");
      } catch {
        existing = {};
      }
      const next = { ...DEFAULT_FEATURES, ...existing, ...body.features };
      await prisma.platformSetting.update({
        where: { id: "default" },
        data: { featuresJson: JSON.stringify(next) },
      });
      await writeAuditLog({
        action: "features.global.update",
        actorUserId: session.user.id,
        meta: body.features,
      });
      return jsonOk({ ok: true, features: next });
    }

    if (!body.planKey) return jsonError("planKey required", 400);
    const plan = await prisma.plan.findUnique({ where: { key: body.planKey } });
    if (!plan) return jsonError("Plan not found", 404);

    let existing: Partial<PlanFeatures> = {};
    try {
      existing = JSON.parse(plan.features || "{}");
    } catch {
      existing = {};
    }
    const next = { ...DEFAULT_FEATURES, ...existing, ...body.features };
    await prisma.plan.update({
      where: { id: plan.id },
      data: { features: JSON.stringify(next) },
    });
    await writeAuditLog({
      action: "features.plan.update",
      actorUserId: session.user.id,
      meta: { planKey: body.planKey, ...body.features },
    });
    return jsonOk({ ok: true, planKey: body.planKey, features: next });
  } catch (err) {
    return handleApiError(err);
  }
}

void (0 as unknown as FeatureKey);
