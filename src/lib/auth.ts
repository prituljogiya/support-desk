import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { MembershipRole } from "@prisma/client";
import { isOrgAdminRole, isStaffRole } from "@/lib/features";
import {
  hasAnyPermission,
  hasPermission,
  type Permission,
} from "@/lib/permissions";
import { AuthError } from "@/lib/auth-error";

export { AuthError };

declare module "next-auth" {
  interface User {
    isSuperAdmin: boolean;
    organizationId?: string | null;
    membershipRole?: MembershipRole | null;
    organizationName?: string | null;
    organizationSlug?: string | null;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      isSuperAdmin: boolean;
      organizationId: string | null;
      membershipRole: MembershipRole | null;
      organizationName: string | null;
      organizationSlug: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    isSuperAdmin: boolean;
    organizationId?: string | null;
    membershipRole?: MembershipRole | null;
    organizationName?: string | null;
    organizationSlug?: string | null;
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const inviteCredentialsSchema = z.object({
  inviteToken: z.string().min(1),
});

async function resolveActiveMembership(userId: string, preferredOrgId?: string | null) {
  if (preferredOrgId) {
    const preferred = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: preferredOrgId,
        },
      },
      include: {
        organization: { select: { id: true, name: true, slug: true, disabled: true } },
      },
    });
    if (preferred && !preferred.organization.disabled && !preferred.disabled)
      return preferred;
  }

  return prisma.membership.findFirst({
    where: {
      userId,
      disabled: false,
      organization: { disabled: false },
    },
    include: {
      organization: { select: { id: true, name: true, slug: true, disabled: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash,
        );
        if (!valid) return null;

        const membership = await resolveActiveMembership(user.id);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          isSuperAdmin: user.isSuperAdmin,
          organizationId: membership?.organizationId ?? null,
          membershipRole: membership?.role ?? null,
          organizationName: membership?.organization.name ?? null,
          organizationSlug: membership?.organization.slug ?? null,
        };
      },
    }),
    Credentials({
      id: "invite",
      name: "Invite",
      credentials: {
        inviteToken: { label: "Invite token", type: "text" },
      },
      async authorize(raw) {
        const parsed = inviteCredentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { acceptInviteByToken } = await import("@/lib/invite-accept");
        const result = await acceptInviteByToken(parsed.data.inviteToken);
        if (!result) return null;

        return {
          id: result.id,
          email: result.email,
          name: result.name,
          isSuperAdmin: result.isSuperAdmin,
          organizationId: result.organizationId,
          membershipRole: result.membershipRole,
          organizationName: result.organizationName,
          organizationSlug: result.organizationSlug,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id!;
        token.isSuperAdmin = user.isSuperAdmin;
        token.organizationId = user.organizationId ?? null;
        token.membershipRole = user.membershipRole ?? null;
        token.organizationName = user.organizationName ?? null;
        token.organizationSlug = user.organizationSlug ?? null;
      }

      if (trigger === "update" && session?.organizationId) {
        const membership = await resolveActiveMembership(
          token.id,
          session.organizationId as string,
        );
        if (membership) {
          token.organizationId = membership.organizationId;
          token.membershipRole = membership.role;
          token.organizationName = membership.organization.name;
          token.organizationSlug = membership.organization.slug;
        }
      }

      // Refresh membership role periodically if org set
      if (token.id && token.organizationId && !user) {
        const membership = await prisma.membership.findUnique({
          where: {
            userId_organizationId: {
              userId: token.id,
              organizationId: token.organizationId,
            },
          },
          include: {
            organization: {
              select: { id: true, name: true, slug: true, disabled: true },
            },
          },
        });
        if (!membership || membership.organization.disabled || membership.disabled) {
          const fallback = await resolveActiveMembership(token.id);
          token.organizationId = fallback?.organizationId ?? null;
          token.membershipRole = fallback?.role ?? null;
          token.organizationName = fallback?.organization.name ?? null;
          token.organizationSlug = fallback?.organization.slug ?? null;
        } else {
          token.membershipRole = membership.role;
          token.organizationName = membership.organization.name;
          token.organizationSlug = membership.organization.slug;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.isSuperAdmin = Boolean(token.isSuperAdmin);
        session.user.organizationId = token.organizationId ?? null;
        session.user.membershipRole = token.membershipRole ?? null;
        session.user.organizationName = token.organizationName ?? null;
        session.user.organizationSlug = token.organizationSlug ?? null;
      }
      return session;
    },
  },
});

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    throw new AuthError("Unauthorized", 401);
  }
  return session;
}

export async function requireOrgSession() {
  const session = await requireSession();
  if (!session.user.organizationId || !session.user.membershipRole) {
    throw new AuthError("No active organization", 403);
  }
  return session as typeof session & {
    user: typeof session.user & {
      organizationId: string;
      membershipRole: MembershipRole;
    };
  };
}

export async function requireStaff() {
  const session = await requireOrgSession();
  if (!isStaffRole(session.user.membershipRole)) {
    throw new AuthError("Forbidden", 403);
  }
  return session;
}

export async function requireOrgAdmin() {
  const session = await requireOrgSession();
  if (!isOrgAdminRole(session.user.membershipRole)) {
    throw new AuthError("Forbidden", 403);
  }
  return session;
}

export async function requirePermission(...permissions: Permission[]) {
  const session = await requireOrgSession();
  const ok = hasAnyPermission(
    session.user.membershipRole,
    permissions,
    { isSuperAdmin: session.user.isSuperAdmin },
  );
  if (!ok) throw new AuthError("Forbidden", 403);
  return session;
}

export async function requireAllPermissions(...permissions: Permission[]) {
  const session = await requireOrgSession();
  const missing = permissions.some(
    (p) =>
      !hasPermission(session.user.membershipRole, p, {
        isSuperAdmin: session.user.isSuperAdmin,
      }),
  );
  if (missing) throw new AuthError("Forbidden", 403);
  return session;
}

export async function requireSuperAdmin() {
  const session = await requireSession();
  if (!session.user.isSuperAdmin) {
    throw new AuthError("Forbidden", 403);
  }
  return session;
}

/** @deprecated Prefer requirePermission */
export async function requireRole(...roles: MembershipRole[]) {
  const session = await requireOrgSession();
  if (!roles.includes(session.user.membershipRole)) {
    throw new AuthError("Forbidden", 403);
  }
  return session;
}

export async function getOrgWithPlan(organizationId: string) {
  return prisma.organization.findUnique({
    where: { id: organizationId },
    include: { plan: true },
  });
}
