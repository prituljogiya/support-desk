import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { computeSlaDueDates } from "@/lib/sla";
import { runTicketAutomations } from "@/lib/automation";
import bcrypt from "bcryptjs";
import crypto from "crypto";

/**
 * Inbound email → ticket.
 * Auth: Authorization: Bearer <CRON_SECRET or org webhook secret>
 * Body (JSON): { org: slug, from, subject, text, to? }
 *
 * Configure your email provider (Resend/SendGrid inbound parse) to POST here.
 */
const schema = z.object({
  org: z.string().min(1),
  from: z.string().email(),
  subject: z.string().min(1).max(200),
  text: z.string().min(1).max(20000),
  to: z.string().optional(),
  name: z.string().max(120).optional(),
});

export async function POST(req: Request) {
  try {
    const secret =
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      req.headers.get("x-inbound-secret") ||
      "";

    const body = schema.parse(await req.json());
    const org = await prisma.organization.findUnique({
      where: { slug: body.org },
      include: { plan: true },
    });
    if (!org || org.disabled) return jsonError("Organization not found", 404);

    const { ensureDefaultChannels } = await import("@/lib/channels");
    await ensureDefaultChannels(org.id);

    const emailConn = await prisma.channelConnection.findUnique({
      where: {
        organizationId_type: { organizationId: org.id, type: "email" },
      },
    });

    const envSecret =
      process.env.CRON_SECRET || process.env.INBOUND_EMAIL_SECRET;
    const okSecret =
      (envSecret && secret === envSecret) ||
      (emailConn?.webhookSecret && secret === emailConn.webhookSecret);
    if (!okSecret) {
      return jsonError("Unauthorized", 401);
    }

    if (emailConn && (!emailConn.enabled || emailConn.status !== "connected")) {
      // Auto-connect on first successful authenticated webhook
      await prisma.channelConnection.update({
        where: { id: emailConn.id },
        data: { status: "connected", enabled: true, lastEventAt: new Date() },
      });
    }

    const email = body.from.toLowerCase();
    const name =
      body.name ||
      email.split("@")[0]?.replace(/[._-]+/g, " ") ||
      "Email customer";

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

    const sla = await computeSlaDueDates(org.id, "medium");
    const ticket = await prisma.ticket.create({
      data: {
        organizationId: org.id,
        subject: body.subject,
        description: body.text,
        priority: "medium",
        requesterId: user.id,
        contactId: contact.id,
        channel: "email",
        channelConnectionId: emailConn?.id,
        department: "general",
        syncStatus: "pending",
        firstResponseDueAt: sla.firstResponseDueAt,
        resolutionDueAt: sla.resolutionDueAt,
        messages: {
          create: {
            authorId: user.id,
            body: body.text,
            isInternal: false,
            direction: "inbound",
            channel: "email",
            channelConnectionId: emailConn?.id,
            syncStatus: "pending",
          },
        },
      },
    });

    if (emailConn) {
      await prisma.channelConnection.update({
        where: { id: emailConn.id },
        data: { lastEventAt: new Date(), status: "connected", enabled: true },
      });
    }

    await runTicketAutomations({
      organizationId: org.id,
      ticketId: ticket.id,
      subject: ticket.subject,
      description: ticket.description,
      priority: ticket.priority,
    });

    // Mark onboarding first ticket
    try {
      const current = JSON.parse(org.onboardingJson || "{}") as Record<
        string,
        unknown
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

    return jsonOk({ ticket: { id: ticket.id, subject: ticket.subject } }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
