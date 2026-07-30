import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { getChannel } from "@/lib/channels";
import { computeSlaDueDates } from "@/lib/sla";
import { runTicketAutomations } from "@/lib/automation";

/**
 * Live chat widget → ticket.
 * Auth: Authorization: Bearer <channel webhookSecret>
 * Body: { org, name?, email, text, subject? }
 */
const schema = z.object({
  org: z.string().min(1),
  email: z.string().email(),
  text: z.string().min(1).max(10000),
  name: z.string().max(120).optional(),
  subject: z.string().max(200).optional(),
  sessionId: z.string().max(120).optional(),
});

export async function POST(req: Request) {
  try {
    const secret =
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      req.headers.get("x-chat-secret") ||
      "";

    const body = schema.parse(await req.json());
    const org = await prisma.organization.findUnique({
      where: { slug: body.org },
      include: { plan: true },
    });
    if (!org || org.disabled) return jsonError("Organization not found", 404);

    const conn = await getChannel(org.id, "chat");
    if (!conn || !conn.enabled || conn.status !== "connected") {
      return jsonError("Live chat channel not connected", 403);
    }
    if (!conn.webhookSecret || secret !== conn.webhookSecret) {
      return jsonError("Unauthorized", 401);
    }

    const email = body.email.toLowerCase();
    const name = body.name || email.split("@")[0] || "Chat visitor";

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

    let contact = await prisma.contact.findUnique({
      where: {
        organizationId_email: { organizationId: org.id, email },
      },
    });
    if (!contact) {
      contact = await prisma.contact.create({
        data: { organizationId: org.id, name, email },
      });
    }

    const sessionKey = body.sessionId || email;
    let ticket = await prisma.ticket.findFirst({
      where: {
        organizationId: org.id,
        channel: "chat",
        customerExternalId: sessionKey,
        status: { in: ["open", "pending"] },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!ticket) {
      const due = await computeSlaDueDates(org.id, "medium");
      ticket = await prisma.ticket.create({
        data: {
          organizationId: org.id,
          subject: body.subject || `Chat from ${name}`,
          description: body.text,
          channel: "chat",
          channelConnectionId: conn.id,
          customerExternalId: sessionKey,
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
    } else {
      await prisma.message.create({
        data: {
          ticketId: ticket.id,
          authorId: user.id,
          body: body.text,
          direction: "inbound",
          channel: "chat",
          channelConnectionId: conn.id,
          syncStatus: "synced",
        },
      });
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { updatedAt: new Date() },
      });
    }

    await prisma.channelConnection.update({
      where: { id: conn.id },
      data: { lastEventAt: new Date() },
    });

    return jsonOk({ ok: true, ticketId: ticket.id }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
