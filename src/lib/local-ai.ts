import { prisma } from "@/lib/prisma";
import { getSectorPack } from "@/lib/sectors";

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function scoreOverlap(query: Set<string>, hay: string) {
  const tokens = tokenize(hay);
  let score = 0;
  for (const t of tokens) {
    if (query.has(t)) score += 1;
  }
  return score;
}

function clip(s: string, n: number) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

/**
 * SmartDesk built-in AI — no third-party LLM APIs.
 * Answers from the org's knowledge base, canned replies, and ticket context.
 */
export async function builtinSuggestReply(opts: {
  organizationId: string;
  ticketId: string;
  tone?: "friendly" | "formal" | "brief";
}) {
  const org = await prisma.organization.findUnique({
    where: { id: opts.organizationId },
    select: { name: true, industry: true },
  });
  const ticket = await prisma.ticket.findFirst({
    where: { id: opts.ticketId, organizationId: opts.organizationId },
    include: {
      messages: {
        where: { isInternal: false },
        orderBy: { createdAt: "asc" },
        take: 12,
        include: { author: { select: { name: true } } },
      },
      contact: { select: { name: true } },
      requester: { select: { name: true } },
    },
  });
  if (!ticket) throw new Error("Ticket not found");

  const queryText = `${ticket.subject} ${ticket.description} ${ticket.messages
    .map((m) => m.body)
    .join(" ")}`;
  const q = new Set(tokenize(queryText));
  const customer =
    ticket.contact?.name || ticket.requester.name || "there";

  const [articles, canned] = await Promise.all([
    prisma.knowledgeArticle.findMany({
      where: {
        organizationId: opts.organizationId,
        published: true,
      },
      select: { title: true, body: true, slug: true },
      take: 80,
    }),
    prisma.cannedResponse.findMany({
      where: { organizationId: opts.organizationId },
      select: { title: true, body: true, keywords: true },
      take: 60,
    }),
  ]);

  const topArticles = articles
    .map((a) => ({
      ...a,
      score: scoreOverlap(q, `${a.title} ${a.body}`),
    }))
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const topCanned = canned
    .map((c) => ({
      ...c,
      score: scoreOverlap(q, `${c.title} ${c.keywords} ${c.body}`),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 1);

  const pack = getSectorPack(org?.industry);
  const greeting =
    opts.tone === "formal"
      ? `Dear ${customer},`
      : `Hi ${customer},`;

  const thanks =
    opts.tone === "brief"
      ? "Thanks for contacting us."
      : `Thanks for reaching out to ${org?.name || "our team"}.`;

  let core = "";
  if (topCanned[0]) {
    core = topCanned[0].body
      .replace(/\{\{name\}\}/gi, customer)
      .replace(/\{\{org\}\}/gi, org?.name || "us");
  } else if (topArticles[0]) {
    core = `I looked into this and here's what typically helps:\n\n${clip(
      topArticles[0].body,
      420,
    )}\n\nYou can also read more in our guide: “${topArticles[0].title}”.`;
  } else {
    core = `I've reviewed your request about “${ticket.subject}”. ${
      pack.sampleSubjects[0]
        ? "We're looking into the details and will follow up with next steps."
        : "A teammate is reviewing this and will update you shortly."
    } If you can share any extra screenshots, order/account IDs, or steps to reproduce, that will help us move faster.`;
  }

  const closing =
    opts.tone === "formal"
      ? "Kind regards,\nSupport Team"
      : opts.tone === "brief"
        ? "— Support"
        : `Best,\n${org?.name || "Support"} Team`;

  const reply = [greeting, "", thanks, "", core, "", closing].join("\n");

  return {
    reply,
    model: "smartdesk-builtin",
    provider: "builtin" as const,
    sources: [
      ...topArticles.map((a) => ({ type: "knowledge" as const, title: a.title })),
      ...topCanned.map((c) => ({ type: "canned" as const, title: c.title })),
    ],
  };
}

export async function builtinSummarize(opts: {
  organizationId: string;
  ticketId: string;
}) {
  const ticket = await prisma.ticket.findFirst({
    where: { id: opts.ticketId, organizationId: opts.organizationId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 30,
        include: { author: { select: { name: true } } },
      },
      assignee: { select: { name: true } },
    },
  });
  if (!ticket) throw new Error("Ticket not found");

  const lastCustomer = [...ticket.messages]
    .reverse()
    .find((m) => !m.isInternal);
  const internals = ticket.messages.filter((m) => m.isInternal).length;

  const summary = [
    `Issue: ${ticket.subject} — ${clip(ticket.description, 180)}`,
    `Status: ${ticket.status} · Priority: ${ticket.priority} · Channel: ${ticket.channel}`,
    `Assignee: ${ticket.assignee?.name || "Unassigned"} · Messages: ${ticket.messages.length} (${internals} internal)`,
    lastCustomer
      ? `Latest customer note: ${clip(lastCustomer.body, 160)}`
      : "Latest customer note: (none yet)",
    `Suggested next step: ${
      ticket.status === "resolved" || ticket.status === "closed"
        ? "Confirm with customer or close if satisfied."
        : ticket.assignee
          ? "Reply with an update or ask for missing details."
          : "Assign an agent and send a first response."
    }`,
  ].join("\n");

  return {
    summary,
    model: "smartdesk-builtin",
    provider: "builtin" as const,
  };
}
export async function builtinChat(opts: {
  organizationId: string;
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
  userId: string;
  userName: string;
  userEmail: string;
  canCreateTicket?: boolean;
}) {
  const org = await prisma.organization.findUnique({
    where: { id: opts.organizationId },
    select: { name: true, industry: true },
  });
  const q = new Set(tokenize(opts.message));
  const pack = getSectorPack(org?.industry);
  const lower = opts.message.toLowerCase();

  // Create ticket from chat — check before queue/open questions
  const createIntent =
    /\b(create|open|file|raise|log|make)\b.{0,24}\bticket\b/i.test(
      opts.message,
    ) ||
    /\bticket\b.{0,12}\b(for|about|regarding)\b/i.test(opts.message) ||
    /^new ticket\b/i.test(opts.message.trim());

  if (createIntent && opts.canCreateTicket !== false) {
    const created = await createTicketFromChat({
      organizationId: opts.organizationId,
      message: opts.message,
      userId: opts.userId,
      userName: opts.userName,
      userEmail: opts.userEmail,
      orgName: org?.name || "Support",
    });
    return {
      reply: created.reply,
      model: "smartdesk-builtin",
      provider: "builtin" as const,
      sources: [] as { type: "knowledge"; title: string; slug: string }[],
      ticket: created.ticket,
    };
  }

  const [articles, openCount, recentTickets] = await Promise.all([
    prisma.knowledgeArticle.findMany({
      where: { organizationId: opts.organizationId, published: true },
      select: { title: true, body: true, slug: true },
      take: 100,
    }),
    prisma.ticket.count({
      where: {
        organizationId: opts.organizationId,
        status: { in: ["open", "pending"] },
      },
    }),
    prisma.ticket.findMany({
      where: { organizationId: opts.organizationId },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: { id: true, subject: true, status: true, channel: true },
    }),
  ]);

  const scored = articles
    .map((a) => ({
      ...a,
      score: scoreOverlap(q, `${a.title} ${a.body}`),
    }))
    .sort((a, b) => b.score - a.score);

  const hits = scored.filter((a) => a.score > 0).slice(0, 3);

  let answer = "";

  if (
    /how many|queue|backlog|workload/.test(lower) ||
    /\bopen tickets?\b/.test(lower)
  ) {
    answer = `${org?.name || "Your desk"} currently has **${openCount}** open/pending tickets in the queue.`;
  } else if (/recent ticket|latest ticket|what.?s new/.test(lower)) {
    answer =
      recentTickets.length === 0
        ? "No tickets yet."
        : `Latest tickets:\n${recentTickets
            .map(
              (t) =>
                `• [${t.status}/${t.channel}] ${t.subject} (\`${t.id.slice(0, 8)}\`)`,
            )
            .join("\n")}`;
  } else if (hits.length) {
    answer = `Based on your knowledge base (${org?.industry || "general"} sector):\n\n${hits
      .map(
        (h, i) =>
          `**${i + 1}. ${h.title}**\n${clip(h.body, 280)}`,
      )
      .join("\n\n")}\n\nI can also **create a ticket** — try: “create ticket: Login failing — customer can’t SSO”`;
  } else if (/hello|hi\b|hey|help/.test(lower)) {
    answer = `Hi — I'm **SmartDesk AI**, built into your workspace (no third-party LLM).\n\nI can:\n• Answer from your knowledge base\n• Report open ticket volume\n• **Create a ticket** when you ask (e.g. “create ticket: Billing refund needed”)\n\nSector focus: ${pack.tagline}`;
  } else {
    answer = `I don't have a strong knowledge-base match for that yet. You can also say create ticket: your subject here and I'll open one.\n\nTip for ${pack.key}: common subjects look like “${pack.sampleSubjects[0]}”.`;
  }

  return {
    reply: answer,
    model: "smartdesk-builtin",
    provider: "builtin" as const,
    sources: hits.map((h) => ({
      type: "knowledge" as const,
      title: h.title,
      slug: h.slug,
    })),
    ticket: null as null | {
      id: string;
      subject: string;
      priority: string;
      link: string;
    },
  };
}

function parsePriority(text: string): "low" | "medium" | "high" | "urgent" {
  const t = text.toLowerCase();
  if (/\burgent\b|\bcritical\b|\bp0\b/.test(t)) return "urgent";
  if (/\bhigh\b|\bp1\b/.test(t)) return "high";
  if (/\blow\b|\bp3\b/.test(t)) return "low";
  return "medium";
}

function parseTicketFields(message: string) {
  const emailMatch = message.match(
    /(?:for|customer|email)\s*[:=]?\s*([^\s@]+@[^\s@]+\.[^\s@]+)/i,
  );
  const customerEmail = emailMatch?.[1]?.toLowerCase() || null;

  let rest = message
    .replace(
      /\b(please\s+)?(create|open|file|raise|log|make)\b.{0,24}\bticket\b[:\s-]*/i,
      "",
    )
    .replace(/^new ticket[:\s-]*/i, "")
    .trim();

  const subjectLabeled = rest.match(
    /subject\s*[:=]\s*(.+?)(?:\s+description\s*[:=]|$)/i,
  );
  const descLabeled = rest.match(/description\s*[:=]\s*(.+)$/i);

  let subject = "";
  let description = "";

  if (subjectLabeled) {
    subject = subjectLabeled[1].trim();
    description = descLabeled?.[1]?.trim() || subject;
  } else if (rest.includes("|")) {
    const [a, ...b] = rest.split("|");
    subject = a.trim();
    description = b.join("|").trim() || subject;
  } else if (rest.includes(" — ") || rest.includes(" - ")) {
    const parts = rest.split(/\s+[—-]\s+/);
    subject = (parts[0] || "").trim();
    description = parts.slice(1).join(" — ").trim() || subject;
  } else if (rest.includes(":")) {
    const idx = rest.indexOf(":");
    subject = rest.slice(0, idx).trim() || rest.slice(idx + 1).trim();
    description = rest.slice(idx + 1).trim() || subject;
  } else {
    subject = clip(rest || "Support request from AI Chat", 120);
    description = rest || "Created via SmartDesk AI Chat.";
  }

  // Strip email from subject noise
  subject = subject
    .replace(/(?:for|customer|email)\s*[:=]?\s*[^\s@]+@[^\s@]+\.[^\s@]+/gi, "")
    .replace(/\bpriority\s*[:=]?\s*(low|medium|high|urgent)\b/gi, "")
    .trim();
  if (!subject) subject = "Support request from AI Chat";
  if (subject.length > 200) subject = subject.slice(0, 197) + "…";

  return {
    subject,
    description: description || subject,
    priority: parsePriority(message),
    customerEmail,
  };
}

async function createTicketFromChat(opts: {
  organizationId: string;
  message: string;
  userId: string;
  userName: string;
  userEmail: string;
  orgName: string;
}) {
  const fields = parseTicketFields(opts.message);
  const { computeSlaDueDates } = await import("@/lib/sla");
  const { runTicketAutomations } = await import("@/lib/automation");
  const { notifyDeskStaff } = await import("@/lib/sector-apply");
  const { ensureDefaultChannels } = await import("@/lib/channels");
  const { parseOnboarding } = await import("@/lib/onboarding");

  await ensureDefaultChannels(opts.organizationId).catch(() => undefined);

  let requesterId = opts.userId;
  let contactEmail = opts.userEmail;
  let contactName = opts.userName;

  if (fields.customerEmail) {
    contactEmail = fields.customerEmail;
    contactName =
      fields.customerEmail.split("@")[0]?.replace(/[._-]+/g, " ") ||
      "Customer";
    let user = await prisma.user.findUnique({
      where: { email: contactEmail },
    });
    if (!user) {
      const bcrypt = await import("bcryptjs");
      const crypto = await import("crypto");
      user = await prisma.user.create({
        data: {
          email: contactEmail,
          name: contactName,
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
          organizationId: opts.organizationId,
        },
      },
      update: {},
      create: {
        userId: user.id,
        organizationId: opts.organizationId,
        role: "customer",
      },
    });
    requesterId = user.id;
  }

  let contact = await prisma.contact.findUnique({
    where: {
      organizationId_email: {
        organizationId: opts.organizationId,
        email: contactEmail,
      },
    },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        organizationId: opts.organizationId,
        name: contactName,
        email: contactEmail,
        createdById: opts.userId,
      },
    });
  }

  const chatConn = await prisma.channelConnection.findUnique({
    where: {
      organizationId_type: {
        organizationId: opts.organizationId,
        type: "chat",
      },
    },
  });

  const sla = await computeSlaDueDates(opts.organizationId, fields.priority);
  const ticket = await prisma.ticket.create({
    data: {
      organizationId: opts.organizationId,
      subject: fields.subject,
      description: fields.description,
      priority: fields.priority,
      requesterId,
      contactId: contact.id,
      channel: "chat",
      channelConnectionId: chatConn?.id || null,
      department: "general",
      syncStatus: "synced",
      firstResponseDueAt: sla.firstResponseDueAt,
      resolutionDueAt: sla.resolutionDueAt,
      messages: {
        create: {
          authorId: requesterId,
          body: fields.description,
          isInternal: false,
          direction: "inbound",
          channel: "chat",
          syncStatus: "synced",
        },
      },
    },
  });

  await runTicketAutomations({
    organizationId: opts.organizationId,
    ticketId: ticket.id,
    subject: ticket.subject,
    description: ticket.description,
    priority: ticket.priority,
  }).catch(() => undefined);

  await notifyDeskStaff({
    organizationId: opts.organizationId,
    title: "AI created a ticket",
    body: ticket.subject,
    link: `/desk/tickets/${ticket.id}`,
    excludeUserId: opts.userId,
    type: "ai_ticket",
  }).catch(() => undefined);

  try {
    const o = await prisma.organization.findUnique({
      where: { id: opts.organizationId },
      select: { onboardingJson: true },
    });
    const state = parseOnboarding(o?.onboardingJson);
    state.firstTicket = true;
    await prisma.organization.update({
      where: { id: opts.organizationId },
      data: { onboardingJson: JSON.stringify(state) },
    });
  } catch {
    /* ignore */
  }

  const link = `/desk/tickets/${ticket.id}`;
  return {
    ticket: {
      id: ticket.id,
      subject: ticket.subject,
      priority: ticket.priority,
      link,
    },
    reply: `Created ticket **${ticket.subject}**\n• Priority: ${ticket.priority}\n• Channel: AI Chat\n• Requester: ${contactEmail}\n• Open: ${link}`,
  };
}
