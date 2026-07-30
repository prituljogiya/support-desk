import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    await requireSuperAdmin();
    const settings = await prisma.platformSetting.upsert({
      where: { id: "default" },
      update: {},
      create: { id: "default" },
    });
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
    });
    const plans = await prisma.plan.findMany({ orderBy: { sortOrder: "asc" } });
    return jsonOk({ settings, coupons, plans });
  } catch (err) {
    return handleApiError(err);
  }
}

const settingsSchema = z.object({
  emailJson: z.string().optional(),
  smsJson: z.string().optional(),
  whatsappJson: z.string().optional(),
  aiJson: z.string().optional(),
  storageJson: z.string().optional(),
  cdnJson: z.string().optional(),
  queueJson: z.string().optional(),
  cacheJson: z.string().optional(),
  securityJson: z.string().optional(),
});

export async function PATCH(req: Request) {
  try {
    const session = await requireSuperAdmin();
    const body = settingsSchema.parse(await req.json());
    const settings = await prisma.platformSetting.upsert({
      where: { id: "default" },
      update: body,
      create: { id: "default", ...body },
    });
    await writeAuditLog({
      action: "platform.settings.update",
      actorUserId: session.user.id,
      meta: { keys: Object.keys(body) },
    });
    return jsonOk({ settings });
  } catch (err) {
    return handleApiError(err);
  }
}

const couponSchema = z.object({
  code: z.string().min(2).max(40),
  percentOff: z.number().int().min(1).max(100),
  maxRedemptions: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSuperAdmin();
    const body = couponSchema.parse(await req.json());
    const coupon = await prisma.coupon.create({
      data: {
        code: body.code.toUpperCase(),
        percentOff: body.percentOff,
        maxRedemptions: body.maxRedemptions,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
    });
    await writeAuditLog({
      action: "coupon.create",
      actorUserId: session.user.id,
      meta: { code: coupon.code },
    });
    return jsonOk({ coupon }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

const couponPatchSchema = z.object({
  id: z.string().min(1),
  percentOff: z.number().int().min(1).max(100).optional(),
  active: z.boolean().optional(),
  maxRedemptions: z.number().int().positive().nullable().optional(),
});

export async function PUT(req: Request) {
  try {
    const session = await requireSuperAdmin();
    const body = couponPatchSchema.parse(await req.json());
    const coupon = await prisma.coupon.update({
      where: { id: body.id },
      data: {
        ...(body.percentOff !== undefined
          ? { percentOff: body.percentOff }
          : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.maxRedemptions !== undefined
          ? { maxRedemptions: body.maxRedemptions }
          : {}),
      },
    });
    await writeAuditLog({
      action: "coupon.update",
      actorUserId: session.user.id,
      meta: { id: coupon.id, code: coupon.code },
    });
    return jsonOk({ coupon });
  } catch (err) {
    return handleApiError(err);
  }
}

const couponDeleteSchema = z.object({ id: z.string().min(1) });

export async function DELETE(req: Request) {
  try {
    const session = await requireSuperAdmin();
    const body = couponDeleteSchema.parse(await req.json());
    const coupon = await prisma.coupon.delete({ where: { id: body.id } });
    await writeAuditLog({
      action: "coupon.delete",
      actorUserId: session.user.id,
      meta: { code: coupon.code },
    });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
