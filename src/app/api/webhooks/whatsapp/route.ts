import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { getChannel } from "@/lib/channels";
import { normalizeWaPhone, waConfigFromJson } from "@/lib/whatsapp";
import { computeSlaDueDates } from "@/lib/sla";
import { runTicketAutomations } from "@/lib/automation";

/**
 * Meta Cloud API webhook verification + inbound messages.
 * Configure callback URL: /api/webhooks/whatsapp?org=<slug>
 * Or send X-Org-Slug header.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const orgSlug = url.searchParams.get("org");

    if (mode !== "subscribe" || !token || !challenge) {
      return jsonError("Bad verification request", 400);
    }
    if (!orgSlug) return jsonError("Missing org query param", 400);

    const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
    if (!org) return jsonError("Unknown org", 404);

    const conn = await getChannel(org.id, "whatsapp");
    const cfg = waConfigFromJson(conn?.configJson || "{}");
    if (!cfg.verifyToken || cfg.verifyToken !== token) {
      return jsonError("Verify token mismatch", 403);
    }

    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

const inboundFallback = z.object({
  org: z.string().min(1),
  from: z.string().min(5).max(32),
  text: z.string().min(1).max(4096),
  name: z.string().max(120).optional(),
  messageId: z.string().max(120).optional(),
});

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const orgSlugHeader =
      req.headers.get("x-org-slug") || url.searchParams.get("org") || "";
    const raw = await req.text();
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return jsonError("Invalid JSON", 400);
    }

    // Manual / test payload (also used by Channels hub "Send test")
    const asFallback = inboundFallback.safeParse(payload);
    if (asFallback.success) {
      return handleInboundText({
        orgSlug: asFallback.data.org,
        from: asFallback.data.from,
        text: asFallback.data.text,
        name: asFallback.data.name,
        messageId: asFallback.data.messageId,
      });
    }

    // Meta Cloud API shape
    const meta = payload as {
      entry?: {
        changes?: {
          value?: {
            metadata?: { phone_number_id?: string };
            contacts?: { profile?: { name?: string }; wa_id?: string }[];
            messages?: {
              from?: string;
              id?: string;
              type?: string;
              text?: { body?: string };
            }[];
          };
        }[];
      }[];
    };

    const change = meta.entry?.[0]?.changes?.[0]?.value;
    const msg = change?.messages?.[0];
    if (!msg?.from || !msg.id) {
      // Status webhooks — ack
      return jsonOk({ ok: true, ignored: true });
    }

    const phoneNumberId = change?.metadata?.phone_number_id;
    let orgSlug = orgSlugHeader;
    let conn = null as Awaited<ReturnType<typeof getChannel>>;

    if (phoneNumberId) {
      conn = await prisma.channelConnection.findFirst({
        where: {
          type: "whatsapp",
          enabled: true,
          OR: [{ externalId: phoneNumberId }, { externalId: null }],
        },
      });
      // Prefer exact externalId match
      const exact = await prisma.channelConnection.findFirst({
        where: { type: "whatsapp", enabled: true, externalId: phoneNumberId },
      });
      if (exact) conn = exact;
      if (conn) {
        const org = await prisma.organization.findUnique({
          where: { id: conn.organizationId },
        });
        orgSlug = org?.slug || orgSlug;
      }
    }

    if (!orgSlug) return jsonError("Cannot resolve organization", 400);

    const text =
      msg.type === "text"
        ? msg.text?.body || ""
        : `[${msg.type || "unsupported"} message]`;
    if (!text.trim()) return jsonOk({ ok: true, ignored: true });

    const contactName = change?.contacts?.[0]?.profile?.name;

    return handleInboundText({
      orgSlug,
      from: msg.from,
      text,
      name: contactName,
      messageId: msg.id,
      connectionId: conn?.id,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

async function handleInboundText(opts: {
  orgSlug: string;
  from: string;
  text: string;
  name?: string;
  messageId?: string;
  connectionId?: string;
}) {
  const org = await prisma.organization.findUnique({
    where: { slug: opts.orgSlug },
    include: { plan: true },
  });
  if (!org || org.disabled) return jsonError("Organization not found", 404);

  const conn =
    (opts.connectionId
      ? await prisma.channelConnection.findUnique({
          where: { id: opts.connectionId },
        })
      : await getChannel(org.id, "whatsapp")) || null;

  if (!conn || !conn.enabled || conn.status !== "connected") {
    return jsonError("WhatsApp channel not connected", 403);
  }

  if (opts.messageId) {
    const dup = await prisma.message.findFirst({
      where: {
        channelConnectionId: conn.id,
        externalMessageId: opts.messageId,
      },
    });
    if (dup) return jsonOk({ ok: true, duplicate: true, ticketId: dup.ticketId });
  }

  const wa = normalizeWaPhone(opts.from);
  const email = `${wa}@whatsapp.local`;
  const name = opts.name || `WhatsApp ${wa}`;

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await bcrypt.hash(
          crypto.randomBytes(24).toString("base64url"),
          10,
        ),
      },
    });
  }

  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: org.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      organizationId: org.id,
      role: "customer",
    },
  });

  let contact = await prisma.contact.findFirst({
    where: {
      organizationId: org.id,
      OR: [{ whatsappE164: wa }, { email }],
    },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        organizationId: org.id,
        name,
        email,
        phone: wa,
        whatsappE164: wa,
      },
    });
  } else if (!contact.whatsappE164) {
    contact = await prisma.contact.update({
      where: { id: contact.id },
      data: { whatsappE164: wa, phone: contact.phone || wa },
    });
  }

  // Reuse open WhatsApp ticket for this customer
  let ticket = await prisma.ticket.findFirst({
    where: {
      organizationId: org.id,
      channel: "whatsapp",
      customerExternalId: wa,
      status: { in: ["open", "pending"] },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!ticket) {
    const due = await computeSlaDueDates(org.id, "medium");
    ticket = await prisma.ticket.create({
      data: {
        organizationId: org.id,
        subject: `WhatsApp from ${name}`,
        description: opts.text,
        channel: "whatsapp",
        channelConnectionId: conn.id,
        customerExternalId: wa,
        requesterId: user.id,
        contactId: contact.id,
        priority: "medium",
        status: "open",
        syncStatus: "synced",
        firstResponseDueAt: due.firstResponseDueAt,
        resolutionDueAt: due.resolutionDueAt,
      },
    });
    await runTicketAutomations({
      organizationId: org.id,
      ticketId: ticket.id,
      subject: ticket.subject,
      description: ticket.description,
      priority: ticket.priority,
    }).catch(() => undefined);
  }

  await prisma.message.create({
    data: {
      ticketId: ticket.id,
      authorId: user.id,
      body: opts.text,
      isInternal: false,
      direction: "inbound",
      channel: "whatsapp",
      externalMessageId: opts.messageId || null,
      channelConnectionId: conn.id,
      syncStatus: "synced",
    },
  });

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { updatedAt: new Date() },
  });

  await prisma.channelConnection.update({
    where: { id: conn.id },
    data: { lastEventAt: new Date(), lastError: null },
  });

  try {
    const current = JSON.parse(org.onboardingJson || "{}") as Record<
      string,
      boolean
    >;
    await prisma.organization.update({
      where: { id: org.id },
      data: {
        onboardingJson: JSON.stringify({
          ...current,
          firstTicket: true,
          connectedChannel: true,
        }),
      },
    });
  } catch {
    /* ignore */
  }

  try {
    const { notifyDeskStaff } = await import("@/lib/sector-apply");
    await notifyDeskStaff({
      organizationId: org.id,
      title: "New WhatsApp message",
      body: opts.text.slice(0, 120),
      link: `/desk/tickets/${ticket.id}`,
    });
  } catch {
    /* ignore */
  }

  return jsonOk({ ok: true, ticketId: ticket.id }, { status: 201 });
}
