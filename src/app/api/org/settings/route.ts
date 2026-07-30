import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgAdmin, getOrgWithPlan } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { can } from "@/lib/features";

export async function GET() {
  try {
    const session = await requireOrgAdmin();
    const org = await getOrgWithPlan(session.user.organizationId);
    if (!org) return jsonError("Not found", 404);

    return jsonOk({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logoUrl,
        brandColor: org.brandColor,
        freshdeskDomain: org.freshdeskDomain,
        freshdeskApiKeySet: Boolean(org.freshdeskApiKey),
        freshdeskWebhookSecretSet: Boolean(org.freshdeskWebhookSecret),
        plan: org.plan,
        canFreshdesk: can(org, "freshdeskSync"),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

const schema = z.object({
  name: z.string().min(1).max(120).optional(),
  logoUrl: z.string().url().nullable().optional().or(z.literal("")),
  brandColor: z.string().max(20).nullable().optional(),
  freshdeskDomain: z.string().max(200).nullable().optional(),
  freshdeskApiKey: z.string().max(200).nullable().optional(),
  freshdeskWebhookSecret: z.string().max(200).nullable().optional(),
});

export async function PATCH(req: Request) {
  try {
    const session = await requireOrgAdmin();
    const body = schema.parse(await req.json());
    const org = await getOrgWithPlan(session.user.organizationId);
    if (!org) return jsonError("Not found", 404);

    if (
      (body.freshdeskDomain !== undefined ||
        body.freshdeskApiKey !== undefined) &&
      !can(org, "freshdeskSync")
    ) {
      return jsonError("Freshdesk sync requires Pro plan or higher", 402);
    }

    const updated = await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.logoUrl !== undefined
          ? { logoUrl: body.logoUrl || null }
          : {}),
        ...(body.brandColor !== undefined
          ? { brandColor: body.brandColor }
          : {}),
        ...(body.freshdeskDomain !== undefined
          ? { freshdeskDomain: body.freshdeskDomain || null }
          : {}),
        ...(body.freshdeskApiKey !== undefined
          ? {
              freshdeskApiKey:
                body.freshdeskApiKey === ""
                  ? null
                  : body.freshdeskApiKey || org.freshdeskApiKey,
            }
          : {}),
        ...(body.freshdeskWebhookSecret !== undefined
          ? {
              freshdeskWebhookSecret:
                body.freshdeskWebhookSecret === ""
                  ? null
                  : body.freshdeskWebhookSecret || org.freshdeskWebhookSecret,
            }
          : {}),
      },
      include: { plan: true },
    });

    if (body.logoUrl !== undefined || body.brandColor !== undefined) {
      try {
        const { parseOnboarding } = await import("@/lib/onboarding");
        const state = parseOnboarding(updated.onboardingJson);
        // Saving branding settings counts even if only color changed from default
        state.brandedPortal = true;
        await prisma.organization.update({
          where: { id: updated.id },
          data: { onboardingJson: JSON.stringify(state) },
        });
      } catch {
        /* ignore */
      }
    }

    return jsonOk({
      organization: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        logoUrl: updated.logoUrl,
        brandColor: updated.brandColor,
        freshdeskDomain: updated.freshdeskDomain,
        freshdeskApiKeySet: Boolean(updated.freshdeskApiKey),
        freshdeskWebhookSecretSet: Boolean(updated.freshdeskWebhookSecret),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
