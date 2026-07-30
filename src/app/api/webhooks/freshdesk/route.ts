import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  handleFreshdeskWebhook,
  type FreshdeskWebhookPayload,
} from "@/lib/freshdesk/sync";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const orgSlug =
      req.headers.get("x-organization-slug") ||
      new URL(req.url).searchParams.get("org");

    let organizationHint: string | null = null;
    let orgWebhookSecret: string | null = null;

    if (orgSlug) {
      const org = await prisma.organization.findUnique({
        where: { slug: orgSlug },
        select: {
          id: true,
          freshdeskWebhookSecret: true,
        },
      });
      if (org) {
        organizationHint = org.id;
        orgWebhookSecret = org.freshdeskWebhookSecret;
      }
    }

    const envSecret = process.env.FRESHDESK_WEBHOOK_SECRET?.trim();
    const requiredSecret = orgWebhookSecret?.trim() || envSecret;
    if (requiredSecret) {
      const provided =
        req.headers.get("x-freshdesk-webhook-secret") ||
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      if (provided !== requiredSecret) {
        return jsonError("Invalid webhook secret", 401);
      }
    }

    const payload = (await req.json()) as FreshdeskWebhookPayload;
    const result = await handleFreshdeskWebhook(payload, organizationHint);
    return jsonOk(result);
  } catch (err) {
    return handleApiError(err);
  }
}
