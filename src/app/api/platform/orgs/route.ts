import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { slugify } from "@/lib/features";
import { writeAuditLog } from "@/lib/audit";
import {
  buildPlatformBusinessReport,
  buildTenantBusinessSnapshot,
} from "@/lib/platform-tenants";

export async function GET(req: Request) {
  try {
    await requireSuperAdmin();
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get("organizationId");

    if (organizationId) {
      const detail = await buildTenantBusinessSnapshot(organizationId);
      if (!detail) return jsonError("Organization not found", 404);
      return jsonOk(detail);
    }

    const [orgs, plans, coupons, settings, auditLogs, users, businessReport] =
      await Promise.all([
        prisma.organization.findMany({
          include: {
            plan: true,
            _count: {
              select: {
                memberships: true,
                tickets: true,
                contacts: true,
                companies: true,
                knowledgeArticles: true,
                automationRules: true,
              },
            },
            memberships: {
              where: { role: { in: ["owner", "admin"] } },
              take: 5,
              include: {
                user: { select: { id: true, email: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.plan.findMany({ orderBy: { sortOrder: "asc" } }),
        prisma.coupon.findMany({ orderBy: { createdAt: "desc" } }),
        prisma.platformSetting.findUnique({ where: { id: "default" } }),
        prisma.auditLog.findMany({
          take: 50,
          orderBy: { createdAt: "desc" },
          include: {
            actor: { select: { email: true, name: true } },
            organization: { select: { name: true, slug: true } },
          },
        }),
        prisma.user.findMany({
          take: 100,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            email: true,
            name: true,
            isSuperAdmin: true,
            createdAt: true,
            memberships: {
              include: {
                organization: { select: { name: true, slug: true } },
              },
            },
          },
        }),
        buildPlatformBusinessReport(),
      ]);

    const openByOrg = await prisma.ticket.groupBy({
      by: ["organizationId"],
      where: { status: { in: ["open", "pending"] } },
      _count: true,
    });
    const openMap = Object.fromEntries(
      openByOrg.map((r) => [r.organizationId, r._count]),
    );

    return jsonOk({
      organizations: orgs.map((o) => ({
        ...o,
        openTickets: openMap[o.id] ?? 0,
      })),
      plans,
      coupons,
      settings: settings ?? {
        id: "default",
        emailJson: "{}",
        smsJson: "{}",
        whatsappJson: "{}",
        aiJson: "{}",
        storageJson: "{}",
        cdnJson: "{}",
        queueJson: "{}",
        cacheJson: "{}",
        securityJson: "{}",
      },
      auditLogs,
      users,
      businessReport,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

const createSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(48).optional(),
  planKey: z.string().min(1).max(40).default("free"),
  ownerEmail: z.string().email().optional(),
  ownerName: z.string().min(1).max(120).optional(),
  ownerPassword: z.string().min(6).max(100).optional(),
  customDomain: z.string().max(200).optional(),
  whiteLabel: z.boolean().optional(),
  industry: z.string().max(80).optional(),
  companySize: z.string().max(40).optional(),
  country: z.string().max(80).optional(),
  region: z.string().max(80).optional(),
  city: z.string().max(80).optional(),
  billingEmail: z.string().email().optional(),
  billingContact: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  website: z.string().max(200).optional(),
  segment: z.string().max(80).optional(),
  mrrCents: z.number().int().min(0).optional(),
  notes: z.string().max(4000).optional(),
  trialEndsAt: z.string().datetime().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSuperAdmin();
    const body = createSchema.parse(await req.json());
    const plan = await prisma.plan.findUnique({ where: { key: body.planKey } });
    if (!plan) return jsonError("Plan not found", 404);

    let slug = slugify(body.slug || body.name);
    const exists = await prisma.organization.findUnique({ where: { slug } });
    if (exists) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const org = await prisma.organization.create({
      data: {
        name: body.name,
        slug,
        planId: plan.id,
        customDomain: body.customDomain || null,
        whiteLabel: body.whiteLabel ?? false,
        industry: body.industry || null,
        companySize: body.companySize || null,
        country: body.country || null,
        region: body.region || null,
        city: body.city || null,
        billingEmail: body.billingEmail || null,
        billingContact: body.billingContact || null,
        phone: body.phone || null,
        website: body.website || null,
        segment: body.segment || null,
        mrrCents: body.mrrCents ?? 0,
        notes: body.notes || null,
        trialEndsAt: body.trialEndsAt ? new Date(body.trialEndsAt) : null,
      },
      include: { plan: true },
    });

    if (body.ownerEmail && body.ownerPassword && body.ownerName) {
      const bcrypt = await import("bcryptjs");
      const passwordHash = await bcrypt.hash(body.ownerPassword, 10);
      const user = await prisma.user.upsert({
        where: { email: body.ownerEmail.toLowerCase() },
        update: { name: body.ownerName, passwordHash },
        create: {
          email: body.ownerEmail.toLowerCase(),
          name: body.ownerName,
          passwordHash,
        },
      });
      await prisma.membership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: "owner",
        },
      });
    }

    await writeAuditLog({
      action: "tenant.create",
      actorUserId: session.user.id,
      organizationId: org.id,
      meta: { name: org.name, slug: org.slug },
    });

    return jsonOk({ organization: org }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

const patchSchema = z.object({
  organizationId: z.string().min(1),
  planKey: z.string().min(1).max(40).optional(),
  disabled: z.boolean().optional(),
  name: z.string().min(2).max(120).optional(),
  customDomain: z.string().max(200).nullable().optional(),
  whiteLabel: z.boolean().optional(),
  storageUsedBytes: z.number().int().min(0).optional(),
  industry: z.string().max(80).nullable().optional(),
  companySize: z.string().max(40).nullable().optional(),
  country: z.string().max(80).nullable().optional(),
  region: z.string().max(80).nullable().optional(),
  city: z.string().max(80).nullable().optional(),
  billingEmail: z.string().email().nullable().optional(),
  billingContact: z.string().max(120).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  website: z.string().max(200).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  segment: z.string().max(80).nullable().optional(),
  mrrCents: z.number().int().min(0).optional(),
  healthScore: z.number().int().min(0).max(100).optional(),
  trialEndsAt: z.string().datetime().nullable().optional(),
  contractEndsAt: z.string().datetime().nullable().optional(),
  brandColor: z.string().max(20).nullable().optional(),
  logoUrl: z.string().max(500).nullable().optional(),
});

export async function PATCH(req: Request) {
  try {
    const session = await requireSuperAdmin();
    const body = patchSchema.parse(await req.json());

    const data: Record<string, unknown> = {};
    if (body.planKey) {
      const plan = await prisma.plan.findUnique({ where: { key: body.planKey } });
      if (!plan) return jsonError("Plan not found", 404);
      data.planId = plan.id;
    }
    const keys = [
      "disabled",
      "name",
      "customDomain",
      "whiteLabel",
      "storageUsedBytes",
      "industry",
      "companySize",
      "country",
      "region",
      "city",
      "billingEmail",
      "billingContact",
      "phone",
      "website",
      "notes",
      "segment",
      "mrrCents",
      "healthScore",
      "brandColor",
      "logoUrl",
    ] as const;
    for (const k of keys) {
      if (body[k] !== undefined) data[k] = body[k];
    }
    if (body.trialEndsAt !== undefined) {
      data.trialEndsAt = body.trialEndsAt ? new Date(body.trialEndsAt) : null;
    }
    if (body.contractEndsAt !== undefined) {
      data.contractEndsAt = body.contractEndsAt
        ? new Date(body.contractEndsAt)
        : null;
    }

    const org = await prisma.organization.update({
      where: { id: body.organizationId },
      data,
      include: { plan: true },
    });

    await writeAuditLog({
      action: body.disabled
        ? "tenant.suspend"
        : body.disabled === false
          ? "tenant.activate"
          : "tenant.update",
      actorUserId: session.user.id,
      organizationId: org.id,
      meta: body,
    });

    return jsonOk({ organization: org });
  } catch (err) {
    return handleApiError(err);
  }
}

const deleteSchema = z.object({
  organizationId: z.string().min(1),
  confirmSlug: z.string().min(1),
});

export async function DELETE(req: Request) {
  try {
    const session = await requireSuperAdmin();
    const body = deleteSchema.parse(await req.json());
    const org = await prisma.organization.findUnique({
      where: { id: body.organizationId },
    });
    if (!org) return jsonError("Organization not found", 404);
    if (org.slug !== body.confirmSlug) {
      return jsonError("Slug confirmation does not match", 400);
    }

    await prisma.organization.delete({ where: { id: org.id } });
    await writeAuditLog({
      action: "tenant.delete",
      actorUserId: session.user.id,
      meta: { name: org.name, slug: org.slug },
    });

    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
