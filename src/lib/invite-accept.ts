import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { homeForRole } from "@/lib/permissions";
import type { MembershipRole } from "@prisma/client";

export type InvitePreview = {
  email: string;
  role: MembershipRole;
  organizationName: string;
  organizationId: string;
  status: string;
  expired: boolean;
  existingUser: boolean;
};

export async function getInvitePreview(
  token: string,
): Promise<InvitePreview | null> {
  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { organization: { select: { id: true, name: true, disabled: true } } },
  });
  if (!invite) return null;

  const existingUser = Boolean(
    await prisma.user.findUnique({
      where: { email: invite.email },
      select: { id: true },
    }),
  );

  return {
    email: invite.email,
    role: invite.role,
    organizationName: invite.organization.name,
    organizationId: invite.organization.id,
    status: invite.status,
    expired: invite.expiresAt < new Date() || invite.organization.disabled,
    existingUser,
  };
}

function nameFromEmail(email: string) {
  const local = email.split("@")[0] || "User";
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .slice(0, 80);
}

/**
 * Accept a pending invite and return session user fields.
 * Creates the account automatically if needed (no password form).
 */
export async function acceptInviteByToken(token: string) {
  const invite = await prisma.invite.findUnique({
    where: { token },
    include: {
      organization: {
        select: { id: true, name: true, slug: true, disabled: true },
      },
    },
  });

  if (!invite || invite.status !== "pending") return null;
  if (invite.expiresAt < new Date()) return null;
  if (invite.organization.disabled) return null;

  let user = await prisma.user.findUnique({
    where: { email: invite.email },
  });

  if (!user) {
    const randomPassword = crypto.randomBytes(24).toString("base64url");
    const passwordHash = await bcrypt.hash(randomPassword, 10);
    user = await prisma.user.create({
      data: {
        email: invite.email,
        name: nameFromEmail(invite.email),
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
      update: { role: invite.role, disabled: false },
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

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isSuperAdmin: user.isSuperAdmin,
    organizationId: invite.organizationId,
    membershipRole: invite.role,
    organizationName: invite.organization.name,
    organizationSlug: invite.organization.slug,
    home: homeForRole(invite.role),
  };
}
