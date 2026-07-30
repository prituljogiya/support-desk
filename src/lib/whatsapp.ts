import { parseChannelConfig } from "@/lib/channels";

type WaConfig = {
  accessToken?: string;
  phoneNumberId?: string;
  verifyToken?: string;
  appSecret?: string;
};

export function waConfigFromJson(raw: string): WaConfig {
  return parseChannelConfig(raw) as WaConfig;
}

/** Send a text message via Meta Cloud API */
export async function sendWhatsAppText(opts: {
  accessToken: string;
  phoneNumberId: string;
  toE164: string;
  body: string;
}) {
  const to = opts.toE164.replace(/\D/g, "");
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${opts.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: opts.body.slice(0, 4096) },
      }),
    },
  );
  const json = (await res.json()) as {
    messages?: { id: string }[];
    error?: { message: string };
  };
  if (!res.ok) {
    throw new Error(json.error?.message || `WhatsApp send failed (${res.status})`);
  }
  return { messageId: json.messages?.[0]?.id || null };
}

export function normalizeWaPhone(raw: string) {
  return raw.replace(/\D/g, "");
}
