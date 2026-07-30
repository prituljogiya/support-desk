import { prisma } from "@/lib/prisma";
import {
  createFreshdeskClient,
  getFreshdeskConfigForOrg,
} from "@/lib/freshdesk/client";
import {
  fromFreshdeskPriority,
  fromFreshdeskStatus,
  stripHtml,
  toFreshdeskPriority,
  toFreshdeskStatus,
} from "@/lib/freshdesk/map";
import { can } from "@/lib/features";

async function clientForTicketOrg(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { plan: true },
  });
  if (!org || !can(org, "freshdeskSync")) return null;
  const config = await getFreshdeskConfigForOrg(organizationId);
  if (!config) return null;
  return createFreshdeskClient(config);
}

export async function syncTicketOutbound(ticketId: string): Promise<void> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { requester: true },
  });
  if (!ticket) return;

  const client = await clientForTicketOrg(ticket.organizationId);
  if (!client) {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { syncStatus: "skipped", syncError: null },
    });
    return;
  }

  try {
    if (ticket.freshdeskId) {
      await client.updateTicket(ticket.freshdeskId, {
        subject: ticket.subject,
        description: ticket.description,
        status: toFreshdeskStatus(ticket.status),
        priority: toFreshdeskPriority(ticket.priority),
      });
    } else {
      const created = await client.createTicket({
        subject: ticket.subject,
        description: ticket.description,
        email: ticket.requester.email,
        name: ticket.requester.name,
        status: toFreshdeskStatus(ticket.status),
        priority: toFreshdeskPriority(ticket.priority),
      });
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { freshdeskId: created.id },
      });
    }

    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        syncStatus: "synced",
        syncError: null,
        lastSyncedAt: new Date(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync error";
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { syncStatus: "error", syncError: message },
    });
  }
}

export async function syncMessageOutbound(messageId: string): Promise<void> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { ticket: true },
  });
  if (!message) return;

  const client = await clientForTicketOrg(message.ticket.organizationId);
  if (!client) {
    await prisma.message.update({
      where: { id: messageId },
      data: { syncStatus: "skipped", syncError: null },
    });
    return;
  }

  if (!message.ticket.freshdeskId) {
    await syncTicketOutbound(message.ticketId);
    const refreshed = await prisma.ticket.findUnique({
      where: { id: message.ticketId },
    });
    if (!refreshed?.freshdeskId) {
      await prisma.message.update({
        where: { id: messageId },
        data: {
          syncStatus: "error",
          syncError: "Parent ticket has no Freshdesk ID",
        },
      });
      return;
    }
    message.ticket.freshdeskId = refreshed.freshdeskId;
  }

  try {
    const fdId = message.ticket.freshdeskId!;
    const created = message.isInternal
      ? await client.createNote(fdId, message.body, true)
      : await client.createReply(fdId, message.body);

    await prisma.message.update({
      where: { id: messageId },
      data: {
        freshdeskId: created.id,
        syncStatus: "synced",
        syncError: null,
        lastSyncedAt: new Date(),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown sync error";
    await prisma.message.update({
      where: { id: messageId },
      data: { syncStatus: "error", syncError: msg },
    });
  }
}

export async function retryPendingSync(organizationId?: string): Promise<{
  tickets: number;
  messages: number;
}> {
  const ticketWhere = {
    syncStatus: { in: ["pending" as const, "error" as const] },
    ...(organizationId ? { organizationId } : {}),
  };

  const tickets = await prisma.ticket.findMany({
    where: ticketWhere,
    take: 25,
    orderBy: { updatedAt: "asc" },
  });
  for (const t of tickets) {
    await syncTicketOutbound(t.id);
  }

  const messages = await prisma.message.findMany({
    where: {
      syncStatus: { in: ["pending", "error"] },
      ...(organizationId
        ? { ticket: { organizationId } }
        : {}),
    },
    take: 25,
    orderBy: { updatedAt: "asc" },
  });
  for (const m of messages) {
    await syncMessageOutbound(m.id);
  }

  return { tickets: tickets.length, messages: messages.length };
}

export async function pullFreshdeskUpdates(
  organizationId?: string,
): Promise<number> {
  const orgs = organizationId
    ? await prisma.organization.findMany({
        where: { id: organizationId },
        include: { plan: true },
      })
    : await prisma.organization.findMany({ include: { plan: true } });

  let updated = 0;
  for (const org of orgs) {
    if (!can(org, "freshdeskSync")) continue;
    const config = await getFreshdeskConfigForOrg(org.id);
    if (!config) continue;
    const client = createFreshdeskClient(config);

    const cursor = await prisma.syncCursor.findUnique({
      where: {
        organizationId_key: { organizationId: org.id, key: "freshdesk" },
      },
    });
    const since = cursor?.lastPullAt
      ? cursor.lastPullAt.toISOString().slice(0, 19)
      : undefined;

    let remoteTickets;
    try {
      remoteTickets = await client.listTickets(since);
    } catch {
      remoteTickets = await client.listTickets();
    }

    for (const remote of remoteTickets) {
      const local = await prisma.ticket.findFirst({
        where: { organizationId: org.id, freshdeskId: remote.id },
        include: { messages: true, requester: true },
      });
      if (!local) continue;

      const status = fromFreshdeskStatus(remote.status);
      const priority = fromFreshdeskPriority(remote.priority);
      if (local.status !== status || local.priority !== priority) {
        await prisma.ticket.update({
          where: { id: local.id },
          data: {
            status,
            priority,
            syncStatus: "synced",
            lastSyncedAt: new Date(),
          },
        });
        updated += 1;
      }

      try {
        const conversations = await client.listConversations(remote.id);
        for (const conv of conversations) {
          const exists = await prisma.message.findFirst({
            where: { freshdeskId: conv.id },
          });
          if (exists) continue;

          const body =
            conv.body_text?.trim() ||
            (conv.body ? stripHtml(conv.body) : "") ||
            "";
          if (!body) continue;

          const localMatch = local.messages.find(
            (m) => !m.freshdeskId && m.body.trim() === body.trim(),
          );
          if (localMatch) {
            await prisma.message.update({
              where: { id: localMatch.id },
              data: {
                freshdeskId: conv.id,
                syncStatus: "synced",
                lastSyncedAt: new Date(),
              },
            });
            continue;
          }

          await prisma.message.create({
            data: {
              ticketId: local.id,
              authorId: local.requesterId,
              body,
              isInternal: Boolean(conv.private),
              freshdeskId: conv.id,
              syncStatus: "synced",
              lastSyncedAt: new Date(),
            },
          });
          updated += 1;
        }
      } catch {
        // conversation pull is best-effort
      }
    }

    await prisma.syncCursor.upsert({
      where: {
        organizationId_key: { organizationId: org.id, key: "freshdesk" },
      },
      create: {
        organizationId: org.id,
        key: "freshdesk",
        lastPullAt: new Date(),
      },
      update: { lastPullAt: new Date() },
    });
  }

  return updated;
}

export type FreshdeskWebhookPayload = {
  freshdesk_webhook?: {
    ticket_id?: number | string;
    ticket_subject?: string;
    ticket_description?: string;
    ticket_status?: string | number;
    ticket_priority?: string | number;
    ticket_latest_public_comment?: string;
    ticket_latest_private_comment?: string;
  };
  ticket?: {
    id?: number | string;
    subject?: string;
    description?: string;
    status?: number | string;
    priority?: number | string;
    email?: string;
  };
  ticket_id?: number | string;
  subject?: string;
  description?: string;
  status?: number;
  priority?: number;
  note?: {
    id?: number | string;
    body?: string;
    body_text?: string;
    private?: boolean;
    ticket_id?: number | string;
  };
};

function parseStatus(value: string | number | undefined) {
  if (typeof value === "number") return fromFreshdeskStatus(value);
  if (!value) return null;
  const lower = String(value).toLowerCase();
  if (lower.includes("pending")) return "pending" as const;
  if (lower.includes("resolved")) return "resolved" as const;
  if (lower.includes("closed")) return "closed" as const;
  if (lower.includes("open")) return "open" as const;
  const num = Number(value);
  if (!Number.isNaN(num)) return fromFreshdeskStatus(num);
  return null;
}

function parsePriority(value: string | number | undefined) {
  if (typeof value === "number") return fromFreshdeskPriority(value);
  if (!value) return null;
  const lower = String(value).toLowerCase();
  if (lower.includes("urgent")) return "urgent" as const;
  if (lower.includes("high")) return "high" as const;
  if (lower.includes("low")) return "low" as const;
  if (lower.includes("medium")) return "medium" as const;
  const num = Number(value);
  if (!Number.isNaN(num)) return fromFreshdeskPriority(num);
  return null;
}

export async function handleFreshdeskWebhook(
  payload: FreshdeskWebhookPayload,
  organizationHint?: string | null,
): Promise<{ ok: boolean; detail: string }> {
  const wh = payload.freshdesk_webhook ?? payload;
  const ticketIdRaw =
    ("ticket_id" in wh ? wh.ticket_id : undefined) ??
    payload.ticket_id ??
    payload.ticket?.id ??
    payload.note?.ticket_id;
  const freshdeskId = Number(ticketIdRaw);
  if (!freshdeskId || Number.isNaN(freshdeskId)) {
    return { ok: false, detail: "Missing ticket_id" };
  }

  let ticket = await prisma.ticket.findFirst({
    where: {
      freshdeskId,
      ...(organizationHint ? { organizationId: organizationHint } : {}),
    },
  });

  if (ticket) {
    const client = await clientForTicketOrg(ticket.organizationId);
    if (client) {
      try {
        const remote = await client.getTicket(freshdeskId);
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            subject: remote.subject || ticket.subject,
            status: fromFreshdeskStatus(remote.status),
            priority: fromFreshdeskPriority(remote.priority),
            syncStatus: "synced",
            lastSyncedAt: new Date(),
          },
        });
      } catch {
        // fall through
      }
    }
  }

  ticket = await prisma.ticket.findFirst({
    where: {
      freshdeskId,
      ...(organizationHint ? { organizationId: organizationHint } : {}),
    },
  });
  if (!ticket) {
    return { ok: true, detail: "No local ticket mapped; ignored" };
  }

  const status = parseStatus(
    ("ticket_status" in wh
      ? (wh as { ticket_status?: string | number }).ticket_status
      : undefined) ??
      payload.status ??
      payload.ticket?.status,
  );
  const priority = parsePriority(
    ("ticket_priority" in wh
      ? (wh as { ticket_priority?: string | number }).ticket_priority
      : undefined) ??
      payload.priority ??
      payload.ticket?.priority,
  );

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      syncStatus: "synced",
      lastSyncedAt: new Date(),
    },
  });

  const publicComment =
    "ticket_latest_public_comment" in wh
      ? (wh as { ticket_latest_public_comment?: string })
          .ticket_latest_public_comment
      : undefined;
  const privateComment =
    "ticket_latest_private_comment" in wh
      ? (wh as { ticket_latest_private_comment?: string })
          .ticket_latest_private_comment
      : undefined;

  for (const [body, isInternal] of [
    [publicComment, false],
    [privateComment, true],
  ] as const) {
    if (!body?.trim()) continue;
    const existing = await prisma.message.findFirst({
      where: { ticketId: ticket.id, body: body.trim() },
    });
    if (existing) continue;
    await prisma.message.create({
      data: {
        ticketId: ticket.id,
        authorId: ticket.requesterId,
        body: body.trim(),
        isInternal,
        syncStatus: "synced",
        lastSyncedAt: new Date(),
      },
    });
  }

  return { ok: true, detail: `Updated ticket ${ticket.id}` };
}
