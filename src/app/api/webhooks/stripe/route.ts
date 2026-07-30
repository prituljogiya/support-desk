import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    const provided =
      req.headers.get("stripe-signature") ||
      req.headers.get("x-stripe-webhook-secret") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

    // Lightweight verification for local/demo; production should use Stripe SDK
    if (secret && provided !== secret && !provided?.includes(secret)) {
      // Allow when STRIPE_WEBHOOK_SECRET matches bearer for demo mode
      if (provided !== secret) {
        return jsonError("Invalid webhook signature", 401);
      }
    }

    const event = (await req.json()) as {
      type?: string;
      data?: {
        object?: {
          client_reference_id?: string;
          customer?: string;
          subscription?: string;
          metadata?: { organizationId?: string; planKey?: string };
        };
      };
    };

    if (event.type === "checkout.session.completed") {
      const obj = event.data?.object;
      const organizationId =
        obj?.metadata?.organizationId || obj?.client_reference_id;
      const planKey = obj?.metadata?.planKey || "pro";
      if (!organizationId) {
        return jsonError("Missing organizationId", 400);
      }

      const plan = await prisma.plan.findUnique({ where: { key: planKey } });
      if (!plan) return jsonError("Unknown plan", 400);

      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          planId: plan.id,
          stripeCustomerId: obj?.customer ?? undefined,
          stripeSubscriptionId: obj?.subscription ?? undefined,
        },
      });

      return jsonOk({ ok: true, organizationId, planKey });
    }

    return jsonOk({ ok: true, ignored: event.type ?? "unknown" });
  } catch (err) {
    return handleApiError(err);
  }
}
