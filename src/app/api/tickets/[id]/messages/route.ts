import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { syncMessageOutbound } from "@/lib/freshdesk/sync";
import { isStaffRole } from "@/lib/features";
import { canAccessPortalTicket } from "@/lib/portal-access";
import { parseChannelConfig } from "@/lib/channels";
import { sendWhatsAppText } from "@/lib/whatsapp";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  body: z.string().min(1).max(10000),
  isInternal: z.boolean().optional().default(false),
});

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await requireOrgSession();
    const { id } = await params;
    const ticket = await prisma.ticket.findFirst({
      where: { id, organizationId: session.user.organizationId },
      include: {
        channelConnection: true,
        contact: true,
      },
    });
    if (!ticket) return jsonError("Ticket not found", 404);

    const isStaff = isStaffRole(session.user.membershipRole);
    if (!isStaff) {
      const ok = await canAccessPortalTicket({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        email: session.user.email!,
        role: session.user.membershipRole,
        ticketId: id,
      });
      if (!ok) return jsonError("Forbidden", 403);
    }

    const body = schema.parse(await req.json());
    if (body.isInternal && !isStaff) {
      return jsonError("Only agents can add internal notes", 403);
    }

    const direction = body.isInternal
      ? "note"
      : isStaff
        ? "outbound"
        : "inbound";

    let waExternalId: string | null = null;
    let waError: string | null = null;

    if (
      isStaff &&
      !body.isInternal &&
      ticket.channel === "whatsapp" &&
      ticket.customerExternalId
    ) {
      const conn =
        ticket.channelConnection ||
        (await prisma.channelConnection.findFirst({
          where: {
            organizationId: ticket.organizationId,
            type: "whatsapp",
            enabled: true,
            status: "connected",
          },
        }));
      const cfg = parseChannelConfig(conn?.configJson || "{}");
      if (conn && cfg.accessToken && (cfg.phoneNumberId || conn.externalId)) {
        try {
          const sent = await sendWhatsAppText({
            accessToken: cfg.accessToken,
            phoneNumberId: cfg.phoneNumberId || conn.externalId!,
            toE164: ticket.customerExternalId,
            body: body.body,
          });
          waExternalId = sent.messageId;
        } catch (e) {
          waError = e instanceof Error ? e.message : "WhatsApp send failed";
        }
      }
    }

    const message = await prisma.message.create({
      data: {
        ticketId: id,
        authorId: session.user.id,
        body: body.body,
        isInternal: body.isInternal,
        direction,
        channel: ticket.channel,
        channelConnectionId: ticket.channelConnectionId,
        externalMessageId: waExternalId,
        syncStatus: waError ? "error" : waExternalId ? "synced" : "pending",
        syncError: waError,
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    const firstResponsePatch =
      isStaff && !body.isInternal && !ticket.firstRespondedAt
        ? { firstRespondedAt: new Date() }
        : {};

    await prisma.ticket.update({
      where: { id },
      data: {
        updatedAt: new Date(),
        ...firstResponsePatch,
        ...(!isStaff && ticket.status === "resolved"
          ? { status: "open", resolvedAt: null, syncStatus: "pending" }
          : {
              syncStatus:
                ticket.syncStatus === "synced" ? "pending" : ticket.syncStatus,
            }),
      },
    });

    if (!waExternalId) {
      await syncMessageOutbound(message.id);
    }

    const refreshed = await prisma.message.findUnique({
      where: { id: message.id },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    return jsonOk(
      {
        message: refreshed,
        channelDelivery: waError
          ? { ok: false, error: waError }
          : waExternalId
            ? { ok: true, provider: "whatsapp", id: waExternalId }
            : null,
      },
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
