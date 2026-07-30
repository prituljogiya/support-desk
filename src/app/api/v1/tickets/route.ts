import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/api-auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { computeSlaDueDates } from "@/lib/sla";
import { runTicketAutomations } from "@/lib/automation";
import { syncTicketOutbound } from "@/lib/freshdesk/sync";
import bcrypt from "bcryptjs";
import crypto from "crypto";

/** GET /api/v1/tickets — list tickets for the API key's organization */
export async function GET(req: Request) {
  try {
    const auth = await requireApiKey(req, "tickets:read");
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = Math.min(Number(searchParams.get("limit") || 50), 100);

    const tickets = await prisma.ticket.findMany({
      where: {
        organizationId: auth.organizationId,
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        subject: true,
        status: true,
        priority: true,
        channel: true,
        createdAt: true,
        updatedAt: true,
        requester: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    return jsonOk({
      tickets,
      meta: { count: tickets.length, organizationId: auth.organizationId },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

const createSchema = z.object({
  subject: z.string().min(1).max(200),
  description: z.string().min(1).max(10000),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  /** Customer email — used as requester; contact is created if missing */
  requesterEmail: z.string().email(),
  requesterName: z.string().min(1).max(120).optional(),
  channel: z.string().min(1).max(40).optional().default("api"),
  department: z.string().min(1).max(80).optional().default("general"),
});

/**
 * POST /api/v1/tickets — create a ticket (requires tickets:write)
 *
 * Body: { subject, description, priority?, requesterEmail, requesterName?, channel? }
 */
export async function POST(req: Request) {
  try {
    const auth = await requireApiKey(req, "tickets:write");
    const body = createSchema.parse(await req.json());
    const orgId = auth.organizationId;
    const email = body.requesterEmail.toLowerCase();
    const name =
      body.requesterName?.trim() ||
      email.split("@")[0]?.replace(/[._-]+/g, " ") ||
      "Customer";

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const passwordHash = await bcrypt.hash(
        crypto.randomBytes(24).toString("base64url"),
        10,
      );
      user = await prisma.user.create({
        data: { email, name, passwordHash },
      });
    }

    await prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: orgId,
        },
      },
      update: {},
      create: {
        userId: user.id,
        organizationId: orgId,
        role: "customer",
      },
    });

    let contact = await prisma.contact.findUnique({
      where: {
        organizationId_email: { organizationId: orgId, email },
      },
    });
    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          organizationId: orgId,
          name: user.name || name,
          email,
        },
      });
    }

    const sla = await computeSlaDueDates(orgId, body.priority);

    const ticket = await prisma.ticket.create({
      data: {
        organizationId: orgId,
        subject: body.subject,
        description: body.description,
        priority: body.priority,
        requesterId: user.id,
        contactId: contact.id,
        syncStatus: "pending",
        channel: body.channel || "api",
        department: body.department || "general",
        firstResponseDueAt: sla.firstResponseDueAt,
        resolutionDueAt: sla.resolutionDueAt,
        messages: {
          create: {
            authorId: user.id,
            body: body.description,
            isInternal: false,
            syncStatus: "pending",
          },
        },
      },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        contact: { select: { id: true, name: true, email: true } },
      },
    });

    await runTicketAutomations({
      organizationId: orgId,
      ticketId: ticket.id,
      subject: ticket.subject,
      description: ticket.description,
      priority: ticket.priority,
    });

    try {
      await syncTicketOutbound(ticket.id);
    } catch {
      // optional sync — don't fail API create
    }

    return jsonOk({ ticket }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
