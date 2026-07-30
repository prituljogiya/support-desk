import { z } from "zod";
import { MembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgAdmin } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { INVITABLE_ROLES } from "@/lib/permissions";
import { getSeatUsage, roleCountsAsSeat } from "@/lib/seats";
import { sendEmail } from "@/lib/mail";
import { parseOnboarding } from "@/lib/onboarding";

export async function GET() {
  try {
    const session = await requireOrgAdmin();
    const [memberships, invites, seats] = await Promise.all([
      prisma.membership.findMany({
        where: { organizationId: session.user.organizationId },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.invite.findMany({
        where: {
          organizationId: session.user.organizationId,
          status: "pending",
        },
        orderBy: { createdAt: "desc" },
      }),
      getSeatUsage(session.user.organizationId),
    ]);

    return jsonOk({
      members: memberships.map((m) => ({
        id: m.id,
        role: m.role,
        disabled: m.disabled,
        user: m.user,
      })),
      invites: invites.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        token: i.token,
        expiresAt: i.expiresAt,
      })),
      roles: INVITABLE_ROLES,
      seats,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(MembershipRole).default("agent"),
});

export async function POST(req: Request) {
  try {
    const session = await requireOrgAdmin();
    const body = inviteSchema.parse(await req.json());
    const email = body.email.toLowerCase();

    if (!INVITABLE_ROLES.includes(body.role)) {
      return jsonError("Role cannot be invited", 400);
    }
    if (body.role === "admin" && session.user.membershipRole !== "owner") {
      return jsonError("Only owners can invite admins", 403);
    }

    if (roleCountsAsSeat(body.role)) {
      const seats = await getSeatUsage(session.user.organizationId);
      if (seats && seats.remaining <= 0) {
        return jsonError(
          `Seat limit reached (${seats.used + seats.pendingInvites}/${seats.limit} on ${seats.planName}). Upgrade your plan or revoke a pending invite.`,
          402,
        );
      }
    }

    const existingMember = await prisma.membership.findFirst({
      where: {
        organizationId: session.user.organizationId,
        user: { email },
      },
    });
    if (existingMember) {
      return jsonError("User is already a member", 409);
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invite = await prisma.invite.create({
      data: {
        organizationId: session.user.organizationId,
        email,
        role: body.role,
        invitedById: session.user.id,
        expiresAt,
      },
    });

    const origin =
      req.headers.get("origin") ||
      process.env.AUTH_URL ||
      "http://localhost:3000";
    const acceptUrl = `${origin.replace(/\/$/, "")}/invite/${invite.token}`;

    let emailResult: { sent: boolean; provider: string } | null = null;
    try {
      emailResult = await sendEmail({
        to: email,
        subject: `You're invited to ${session.user.organizationName || "Support Desk"}`,
        text: `You've been invited as ${body.role}.\n\nAccept your invite (no password form needed):\n${acceptUrl}\n\nThis link expires in 7 days.`,
        html: `<p>You've been invited as <strong>${body.role}</strong>.</p><p><a href="${acceptUrl}">Accept invite &amp; continue</a></p><p>This link expires in 7 days.</p>`,
      });
    } catch (e) {
      console.error("invite email failed", e);
    }

    try {
      const org = await prisma.organization.findUnique({
        where: { id: session.user.organizationId },
        select: { onboardingJson: true },
      });
      const state = parseOnboarding(org?.onboardingJson);
      state.invitedTeam = true;
      await prisma.organization.update({
        where: { id: session.user.organizationId },
        data: { onboardingJson: JSON.stringify(state) },
      });
    } catch {
      /* ignore */
    }

    return jsonOk(
      {
        invite: {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          token: invite.token,
          expiresAt: invite.expiresAt,
          acceptUrl: `/invite/${invite.token}`,
          absoluteAcceptUrl: acceptUrl,
        },
        email: emailResult,
      },
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}

const acceptSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1).max(120).optional(),
  password: z.string().min(6).max(100).optional(),
});

/** @deprecated Prefer invite magic-link signIn("invite"). Kept for API clients. */
export async function PUT(req: Request) {
  try {
    const body = acceptSchema.parse(await req.json());
    const { acceptInviteByToken } = await import("@/lib/invite-accept");
    const result = await acceptInviteByToken(body.token);
    if (!result) {
      return jsonError("Invite not found, expired, or already used", 404);
    }
    return jsonOk({
      organizationId: result.organizationId,
      role: result.membershipRole,
      email: result.email,
      home: result.home,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
