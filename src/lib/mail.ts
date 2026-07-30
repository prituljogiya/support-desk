import { prisma } from "@/lib/prisma";

type EmailJson = {
  provider?: "resend" | "smtp" | "log";
  apiKey?: string;
  from?: string;
  /** When provider is smtp — not fully implemented; use resend or log */
  host?: string;
};

function parseEmailJson(raw: string): EmailJson {
  try {
    return JSON.parse(raw) as EmailJson;
  } catch {
    return {};
  }
}

export async function getMailConfig(): Promise<EmailJson> {
  const settings = await prisma.platformSetting.findUnique({
    where: { id: "default" },
  });
  return parseEmailJson(settings?.emailJson || "{}");
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const cfg = await getMailConfig();
  const from = cfg.from || process.env.EMAIL_FROM || "noreply@supportdesk.local";

  if (cfg.provider === "resend" && (cfg.apiKey || process.env.RESEND_API_KEY)) {
    const key = cfg.apiKey || process.env.RESEND_API_KEY!;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        html: opts.html || opts.text.replace(/\n/g, "<br/>"),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend failed: ${res.status} ${body}`);
    }
    return { sent: true as const, provider: "resend" as const };
  }

  // Dev / unconfigured: log only so invites still work via link
  console.info("[mail:log]", {
    from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text.slice(0, 500),
  });
  return { sent: false as const, provider: "log" as const };
}
