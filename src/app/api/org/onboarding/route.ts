import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgSession, requirePermission } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import {
  onboardingComplete,
  parseOnboarding,
  type OnboardingState,
} from "@/lib/onboarding";

export async function GET() {
  try {
    const session = await requireOrgSession();
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        onboardingJson: true,
        onboardingCompletedAt: true,
        logoUrl: true,
        brandColor: true,
        _count: { select: { tickets: true, invites: true, memberships: true } },
      },
    });

    const state = parseOnboarding(org?.onboardingJson);
    // Auto-detect progress from real data
    if ((org?._count.invites ?? 0) > 0 || (org?._count.memberships ?? 0) > 1) {
      state.invitedTeam = true;
    }
    // Default signup brand color doesn't count — need logo or explicit checklist mark
    if (org?.logoUrl || state.brandedPortal) {
      state.brandedPortal = true;
    }
    if ((org?._count.tickets ?? 0) > 0) {
      state.firstTicket = true;
    }

    return jsonOk({
      state,
      completed: onboardingComplete(state) || Boolean(org?.onboardingCompletedAt),
      completedAt: org?.onboardingCompletedAt,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

const patchSchema = z.object({
  invitedTeam: z.boolean().optional(),
  brandedPortal: z.boolean().optional(),
  firstTicket: z.boolean().optional(),
  dismissed: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  try {
    const session = await requirePermission("settings.manage");
    const body = patchSchema.parse(await req.json());
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
    });
    const current = parseOnboarding(org?.onboardingJson);
    const next: OnboardingState = { ...current, ...body };
    const done = onboardingComplete(next);

    await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: {
        onboardingJson: JSON.stringify(next),
        onboardingCompletedAt: done ? new Date() : null,
      },
    });

    return jsonOk({ state: next, completed: done });
  } catch (err) {
    return handleApiError(err);
  }
}
