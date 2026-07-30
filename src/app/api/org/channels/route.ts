import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireOrgSession,
  requirePermission,
} from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  CHANNEL_TYPES,
  ensureDefaultChannels,
  listOrgChannels,
  parseChannelConfig,
  type ChannelType,
} from "@/lib/channels";
import { can } from "@/lib/features";
import { parseOnboarding } from "@/lib/onboarding";
import crypto from "crypto";

export async function GET() {
  try {
    const session = await requireOrgSession();
    const channels = await listOrgChannels(session.user.organizationId);
    return jsonOk({ channels });
  } catch (err) {
    return handleApiError(err);
  }
}

const connectSchema = z.object({
  type: z.enum(CHANNEL_TYPES),
  /** One-click enable for built-in channels */
  action: z.enum(["enable", "disable", "connect", "disconnect"]).default("connect"),
  name: z.string().min(1).max(80).optional(),
  accessToken: z.string().max(500).optional(),
  phoneNumberId: z.string().max(80).optional(),
  verifyToken: z.string().max(120).optional(),
  rotateSecret: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requirePermission("channels.manage");
    const body = connectSchema.parse(await req.json());
    const orgId = session.user.organizationId;
    await ensureDefaultChannels(orgId);

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: { plan: true },
    });
    if (!org) return jsonError("Org not found", 404);

    const type = body.type as ChannelType;
    if (type === "whatsapp" && !can(org, "whatsapp")) {
      return jsonError("WhatsApp is not on your plan — upgrade to connect.", 402);
    }
    if (type === "chat" && !can(org, "liveChat")) {
      return jsonError("Live chat is not on your plan — upgrade to enable.", 402);
    }

    const existing = await prisma.channelConnection.findUnique({
      where: { organizationId_type: { organizationId: orgId, type } },
    });
    if (!existing) return jsonError("Channel missing", 404);

    const cfg = parseChannelConfig(existing.configJson);

    if (body.action === "disable" || body.action === "disconnect") {
      const updated = await prisma.channelConnection.update({
        where: { id: existing.id },
        data: {
          enabled: body.action === "disable" ? false : existing.enabled,
          status: "disconnected",
          lastError: null,
        },
      });
      return jsonOk({ channel: updated });
    }

    // enable / connect
    if (type === "whatsapp") {
      if (!body.accessToken || !body.phoneNumberId) {
        return jsonError("accessToken and phoneNumberId required for WhatsApp", 400);
      }
      cfg.accessToken = body.accessToken;
      cfg.phoneNumberId = body.phoneNumberId;
      cfg.verifyToken =
        body.verifyToken ||
        cfg.verifyToken ||
        crypto.randomBytes(16).toString("base64url");
    }

    if (body.rotateSecret || !existing.webhookSecret) {
      // regenerate below
    }

    const updated = await prisma.channelConnection.update({
      where: { id: existing.id },
      data: {
        name: body.name || existing.name,
        enabled: true,
        status: "connected",
        externalId:
          type === "whatsapp"
            ? body.phoneNumberId || existing.externalId
            : existing.externalId,
        configJson: JSON.stringify(cfg),
        webhookSecret:
          body.rotateSecret || !existing.webhookSecret
            ? crypto.randomBytes(24).toString("base64url")
            : existing.webhookSecret,
        lastError: null,
      },
    });

    try {
      const state = parseOnboarding(org.onboardingJson);
      state.connectedChannel = true;
      await prisma.organization.update({
        where: { id: orgId },
        data: { onboardingJson: JSON.stringify(state) },
      });
    } catch {
      /* ignore */
    }

    return jsonOk({ channel: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
