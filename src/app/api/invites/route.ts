import { z } from "zod";
import bcrypt from "bcryptjs";
import { MembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgAdmin } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { isOrgAdminRole } from "@/lib/features";
import { INVITABLE_ROLES, homeForRole } from "@/lib/permissions";

export async function GET() {
  try {
    const session = await requireOrgAdmin();
    const [memberships, invites] = await Promise.all([
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

    return jsonOk(
      {
        invite: {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          token: invite.token,
          expiresAt: invite.expiresAt,
          acceptUrl: `/invite/${invite.token}`,
        },
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

export async function PUT(req: Request) {
  try {
    const body = acceptSchema.parse(await req.json());
    const invite = await prisma.invite.findUnique({
      where: { token: body.token },
      include: { organization: true },
    });

    if (!invite || invite.status !== "pending") {
      return jsonError("Invite not found", 404);
    }
    if (invite.expiresAt < new Date()) {
      return jsonError("Invite expired", 410);
    }
    if (invite.organization.disabled) {
      return jsonError("Organization is disabled", 403);
    }

    let user = await prisma.user.findUnique({
      where: { email: invite.email },
    });

    if (!user) {
      if (!body.name || !body.password) {
        return jsonError("Name and password required for new accounts", 400);
      }
      const passwordHash = await bcrypt.hash(body.password, 10);
      user = await prisma.user.create({
        data: {
          email: invite.email,
          name: body.name,
          passwordHash,
        },
      });
    }

    await prisma.$transaction([
      prisma.membership.upsert({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: invite.organizationId,
          },
        },
        update: { role: invite.role },
        create: {
          userId: user.id,
          organizationId: invite.organizationId,
          role: invite.role,
        },
      }),
      prisma.invite.update({
        where: { id: invite.id },
        data: { status: "accepted" },
      }),
    ]);

    return jsonOk({
      organizationId: invite.organizationId,
      role: invite.role,
      email: user.email,
      isOrgAdmin: isOrgAdminRole(invite.role),
      home: homeForRole(invite.role),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
