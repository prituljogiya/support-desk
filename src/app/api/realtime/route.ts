import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";

/**
 * Lightweight live delta for desk/portal.
 * Client polls every few seconds; returns change fingerprint + unread count.
 */
export async function GET(req: Request) {
  try {
    const session = await requireOrgSession();
    const orgId = session.user.organizationId;
    const { searchParams } = new URL(req.url);
    const sinceRaw = searchParams.get("since");
    const since = sinceRaw ? new Date(sinceRaw) : new Date(Date.now() - 60_000);
    const validSince = Number.isNaN(since.getTime())
      ? new Date(Date.now() - 60_000)
      : since;

    const [ticketTouch, messageTouch, notifUnread, latestTicket, openCount] =
      await Promise.all([
        prisma.ticket.findFirst({
          where: {
            organizationId: orgId,
            updatedAt: { gt: validSince },
          },
          orderBy: { updatedAt: "desc" },
          select: { id: true, updatedAt: true, subject: true, channel: true },
        }),
        prisma.message.findFirst({
          where: {
            createdAt: { gt: validSince },
            ticket: { organizationId: orgId },
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            createdAt: true,
            ticketId: true,
            isInternal: true,
          },
        }),
        prisma.notification.count({
          where: {
            organizationId: orgId,
            userId: session.user.id,
            readAt: null,
          },
        }),
        prisma.ticket.findFirst({
          where: { organizationId: orgId },
          orderBy: { updatedAt: "desc" },
          select: { updatedAt: true },
        }),
        prisma.ticket.count({
          where: {
            organizationId: orgId,
            status: { in: ["open", "pending"] },
          },
        }),
      ]);

    const changed = Boolean(ticketTouch || messageTouch);
    const cursor = new Date(
      Math.max(
        latestTicket?.updatedAt.getTime() || 0,
        messageTouch?.createdAt.getTime() || 0,
        Date.now(),
      ),
    ).toISOString();

    return jsonOk({
      live: true,
      changed,
      cursor,
      serverTime: new Date().toISOString(),
      unread: notifUnread,
      openQueue: openCount,
      latestTicket: ticketTouch
        ? {
            id: ticketTouch.id,
            subject: ticketTouch.subject,
            channel: ticketTouch.channel,
            updatedAt: ticketTouch.updatedAt.toISOString(),
          }
        : null,
      latestMessage: messageTouch
        ? {
            id: messageTouch.id,
            ticketId: messageTouch.ticketId,
            createdAt: messageTouch.createdAt.toISOString(),
          }
        : null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
