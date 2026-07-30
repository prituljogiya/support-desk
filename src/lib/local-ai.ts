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
}) {
  const org = await prisma.organization.findUnique({
    where: { id: opts.organizationId },
    select: { name: true, industry: true },
  });
  const q = new Set(tokenize(opts.message));
  const pack = getSectorPack(org?.industry);

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
  const lower = opts.message.toLowerCase();

  let answer = "";

  if (
    /how many|open ticket|queue|backlog|workload/.test(lower) ||
    (lower.includes("open") && lower.includes("ticket"))
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
      .join("\n\n")}\n\nI can also draft a customer reply from a ticket — open any ticket and use **AI draft reply**.`;
  } else if (/hello|hi\b|hey|help/.test(lower)) {
    answer = `Hi — I'm **SmartDesk AI**, built into your workspace (no third-party LLM). I answer from *your* knowledge base and desk data.\n\nTry asking about a how-to topic, open ticket volume, or “summarize recent tickets”.\n\nSector focus: ${pack.tagline}`;
  } else {
    answer = `I don't have a strong knowledge-base match for that yet. Add a published KB article covering this topic, or ask about open tickets / recent activity.\n\nTip for ${pack.key}: common subjects look like “${pack.sampleSubjects[0]}”.`;
  }

  return {
    reply: answer,
    model: "smartdesk-builtin",
    provider: "builtin" as const,
    sources: hits.map((h) => ({ type: "knowledge" as const, title: h.title, slug: h.slug })),
  };
}
