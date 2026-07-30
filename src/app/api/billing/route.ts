import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireOrgAdmin,
  requireSuperAdmin,
  getOrgWithPlan,
} from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { parsePlanFeatures } from "@/lib/features";
import { ASSIGNABLE_ROLES } from "@/lib/permissions";
import { isStripeConfigured } from "@/lib/stripe";

export async function GET() {
  try {
    const session = await requireOrgAdmin();
    const org = await getOrgWithPlan(session.user.organizationId);
    if (!org) return jsonError("Organization not found", 404);

    const plans = await prisma.plan.findMany({ orderBy: { sortOrder: "asc" } });
    const seatCount = await prisma.membership.count({
      where: {
        organizationId: org.id,
        role: { in: ASSIGNABLE_ROLES },
      },
    });

    return jsonOk({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        features: parsePlanFeatures(org.plan.features),
        stripeCustomerId: org.stripeCustomerId,
        stripeSubscriptionId: org.stripeSubscriptionId,
      },
      plans: plans.map((p) => ({
        ...p,
        features: parsePlanFeatures(p.features),
      })),
      usage: { seats: seatCount, seatLimit: org.plan.seatLimit },
      stripeConfigured: isStripeConfigured(),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

const assignSchema = z.object({
  planKey: z.enum(["free", "pro", "enterprise"]),
  organizationId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = assignSchema.parse(await req.json());

    let organizationId = body.organizationId;
    if (organizationId) {
      await requireSuperAdmin();
    } else {
      const session = await requireOrgAdmin();
      // Org owners/admins can assign plans in Admin (demo + Stripe-optional flows).
      // Stripe Checkout remains available via PUT when STRIPE_* is configured.
      organizationId = session.user.organizationId;
    }

    const plan = await prisma.plan.findUnique({ where: { key: body.planKey } });
    if (!plan) return jsonError("Plan not found", 404);

    const org = await prisma.organization.update({
      where: { id: organizationId },
      data: { planId: plan.id },
      include: { plan: true },
    });

    return jsonOk({ organization: org });
  } catch (err) {
    return handleApiError(err);
  }
}

const checkoutSchema = z.object({
  planKey: z.enum(["pro", "enterprise"]),
});

export async function PUT(req: Request) {
  try {
    const session = await requireOrgAdmin();
    if (!isStripeConfigured()) {
      return jsonError("Stripe is not configured", 400);
    }

    const body = checkoutSchema.parse(await req.json());
    const priceId =
      body.planKey === "pro"
        ? process.env.STRIPE_PRICE_PRO
        : process.env.STRIPE_PRICE_ENTERPRISE;

    if (!priceId?.trim()) {
      return jsonError(`Missing Stripe price for ${body.planKey}`, 400);
    }

    const org = await getOrgWithPlan(session.user.organizationId);
    if (!org) return jsonError("Organization not found", 404);

    const secret = process.env.STRIPE_SECRET_KEY!.trim();
    const auth = Buffer.from(`${secret}:`).toString("base64");
    const baseUrl =
      process.env.AUTH_URL?.replace(/\/$/, "") || "http://localhost:3000";

    const form = new URLSearchParams();
    form.set("mode", "subscription");
    form.set("success_url", `${baseUrl}/desk/admin/billing?success=1`);
    form.set("cancel_url", `${baseUrl}/desk/admin/billing?canceled=1`);
    form.set("line_items[0][price]", priceId.trim());
    form.set("line_items[0][quantity]", "1");
    form.set("client_reference_id", org.id);
    form.set("metadata[organizationId]", org.id);
    form.set("metadata[planKey]", body.planKey);
    if (org.stripeCustomerId) {
      form.set("customer", org.stripeCustomerId);
    } else {
      form.set("customer_email", session.user.email);
    }

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const data = (await res.json()) as {
      id?: string;
      url?: string;
      error?: { message?: string };
    };
    if (!res.ok || !data.url) {
      return jsonError(data.error?.message || "Stripe Checkout failed", 502);
    }

    return jsonOk({ url: data.url, sessionId: data.id });
  } catch (err) {
    return handleApiError(err);
  }
}
