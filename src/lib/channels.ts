import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { can, type FeatureKey } from "@/lib/features";

export const CHANNEL_TYPES = [
  "portal",
  "email",
  "whatsapp",
  "api",
  "chat",
] as const;

export type ChannelType = (typeof CHANNEL_TYPES)[number];

export const CHANNEL_META: Record<
  ChannelType,
  {
    label: string;
    description: string;
    feature?: FeatureKey;
    providerDefault: string;
  }
> = {
  portal: {
    label: "Customer portal",
    description: "Customers create and reply to tickets in your branded portal.",
    providerDefault: "built_in",
  },
  email: {
    label: "Email",
    description: "Inbound email webhook creates tickets automatically.",
    providerDefault: "inbound_webhook",
  },
  whatsapp: {
    label: "WhatsApp",
    description: "Meta Cloud API — customers message your business number.",
    feature: "whatsapp",
    providerDefault: "meta_cloud",
  },
  api: {
    label: "Public API",
    description: "Create tickets from your product with org API keys.",
    providerDefault: "built_in",
  },
  chat: {
    label: "Live chat",
    description: "Website widget posts create chat-channel tickets.",
    feature: "liveChat",
    providerDefault: "built_in",
  },
};

export function parseChannelConfig(raw: string | null | undefined) {
  try {
    return (raw ? JSON.parse(raw) : {}) as Record<string, string>;
  } catch {
    return {} as Record<string, string>;
  }
}

export function channelLabel(type: string) {
  return CHANNEL_META[type as ChannelType]?.label || type;
}

/** Ensure default channel rows exist for an org (idempotent). */
export async function ensureDefaultChannels(organizationId: string) {
  const defaults: { type: ChannelType; name: string; status: string }[] = [
    { type: "portal", name: "Customer portal", status: "connected" },
    { type: "email", name: "Email inbound", status: "disconnected" },
    { type: "whatsapp", name: "WhatsApp Business", status: "disconnected" },
    { type: "api", name: "Public API", status: "connected" },
    { type: "chat", name: "Live chat widget", status: "disconnected" },
  ];

  for (const d of defaults) {
    const meta = CHANNEL_META[d.type];
    await prisma.channelConnection.upsert({
      where: {
        organizationId_type: { organizationId, type: d.type },
      },
      create: {
        organizationId,
        type: d.type,
        name: d.name,
        provider: meta.providerDefault,
        status: d.status,
        webhookSecret:
          d.type === "email" || d.type === "whatsapp" || d.type === "chat"
            ? crypto.randomBytes(24).toString("base64url")
            : null,
        enabled: true,
        configJson: "{}",
      },
      update: {},
    });
  }
}

export async function listOrgChannels(organizationId: string) {
  await ensureDefaultChannels(organizationId);
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { plan: true },
  });
  const rows = await prisma.channelConnection.findMany({
    where: { organizationId },
    orderBy: { type: "asc" },
  });

  return rows.map((row) => {
    const type = row.type as ChannelType;
    const meta = CHANNEL_META[type];
    const featureOk = meta?.feature ? can(org!, meta.feature) : true;
    const cfg = parseChannelConfig(row.configJson);
    return {
      id: row.id,
      type: row.type,
      name: row.name,
      provider: row.provider,
      status: row.status,
      enabled: row.enabled && featureOk,
      featureLocked: Boolean(meta?.feature && !featureOk),
      featureKey: meta?.feature ?? null,
      label: meta?.label || row.name,
      description: meta?.description || "",
      externalId: row.externalId,
      webhookSecret: row.webhookSecret,
      lastError: row.lastError,
      lastEventAt: row.lastEventAt,
      hasAccessToken: Boolean(cfg.accessToken),
      phoneNumberId: cfg.phoneNumberId || row.externalId || null,
      verifyTokenSet: Boolean(cfg.verifyToken),
    };
  });
}

export async function getChannel(
  organizationId: string,
  type: ChannelType | string,
) {
  await ensureDefaultChannels(organizationId);
  return prisma.channelConnection.findUnique({
    where: { organizationId_type: { organizationId, type } },
  });
}
