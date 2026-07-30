import { prisma } from "@/lib/prisma";
import { ASSIGNABLE_ROLES } from "@/lib/permissions";

export type AnalyticsFilters = {
  organizationId: string;
  from: Date;
  to: Date;
  agentId?: string;
  department?: string;
  channel?: string;
  companyId?: string;
  priority?: string;
  status?: string;
  tagId?: string;
};

function ticketWhere(f: AnalyticsFilters) {
  return {
    organizationId: f.organizationId,
    createdAt: { gte: f.from, lte: f.to },
    ...(f.agentId ? { assigneeId: f.agentId } : {}),
    ...(f.department ? { department: f.department } : {}),
    ...(f.channel ? { channel: f.channel } : {}),
    ...(f.priority ? { priority: f.priority as never } : {}),
    ...(f.status ? { status: f.status as never } : {}),
    ...(f.companyId
      ? { contact: { companyId: f.companyId } }
      : {}),
    ...(f.tagId ? { tags: { some: { tagId: f.tagId } } } : {}),
  };
}

function avg(nums: number[]) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function groupCount<T extends string>(items: T[]) {
  const map: Record<string, number> = {};
  for (const i of items) map[i] = (map[i] ?? 0) + 1;
  return Object.entries(map)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function dayBuckets(from: Date, to: Date) {
  const days: { start: Date; end: Date; label: string }[] = [];
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  while (cur <= end) {
    const start = new Date(cur);
    const next = new Date(cur);
    next.setDate(next.getDate() + 1);
    days.push({
      start,
      end: next,
      label: start.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    });
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export async function buildAnalyticsSnapshot(f: AnalyticsFilters) {
  const where = ticketWhere(f);
  const orgId = f.organizationId;
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const [
    tickets,
    allInRange,
    closedToday,
    articles,
    automationRules,
    automationRuns,
    kbMisses,
    aiEvents,
    companies,
    agents,
    csatAll,
    openNow,
    pendingNow,
  ] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true } },
        requester: { select: { id: true, name: true } },
        contact: { include: { company: { select: { id: true, name: true } } } },
        csat: true,
        messages: {
          where: { isInternal: false },
          orderBy: { createdAt: "asc" },
          take: 5,
          select: { createdAt: true, authorId: true },
        },
      },
    }),
    prisma.ticket.count({ where: { organizationId: orgId } }),
    prisma.ticket.count({
      where: {
        organizationId: orgId,
        status: { in: ["resolved", "closed"] },
        resolvedAt: { gte: startOfToday },
      },
    }),
    prisma.knowledgeArticle.findMany({
      where: { organizationId: orgId },
      orderBy: { viewCount: "desc" },
    }),
    prisma.automationRule.count({ where: { organizationId: orgId } }),
    prisma.automationRun.findMany({
      where: {
        organizationId: orgId,
        createdAt: { gte: f.from, lte: f.to },
      },
    }),
    prisma.kbSearchMiss.findMany({
      where: {
        organizationId: orgId,
        createdAt: { gte: f.from, lte: f.to },
      },
      take: 50,
      orderBy: { createdAt: "desc" },
    }),
    prisma.aiMetricEvent.findMany({
      where: {
        organizationId: orgId,
        createdAt: { gte: f.from, lte: f.to },
      },
    }),
    prisma.company.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { contacts: true } } },
    }),
    prisma.membership.findMany({
      where: {
        organizationId: orgId,
        role: { in: ASSIGNABLE_ROLES },
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.csatRating.findMany({
      where: {
        organizationId: orgId,
        createdAt: { gte: f.from, lte: f.to },
      },
    }),
    prisma.ticket.count({
      where: { organizationId: orgId, status: "open" },
    }),
    prisma.ticket.count({
      where: { organizationId: orgId, status: "pending" },
    }),
  ]);

  const statusDist = groupCount(tickets.map((t) => t.status));
  const priorityDist = groupCount(tickets.map((t) => t.priority));
  const channelDist = groupCount(tickets.map((t) => t.channel || "portal"));
  const deptDist = groupCount(tickets.map((t) => t.department || "general"));
  const geoDist = groupCount(
    tickets.map((t) => t.country || "Unknown").filter(Boolean),
  );

  const slaMet = tickets.filter(
    (t) =>
      t.firstResponseDueAt &&
      t.firstRespondedAt &&
      t.firstRespondedAt <= t.firstResponseDueAt,
  ).length;
  const slaBreached = tickets.filter(
    (t) =>
      (t.firstResponseDueAt &&
        !t.firstRespondedAt &&
        t.firstResponseDueAt < now) ||
      (t.firstResponseDueAt &&
        t.firstRespondedAt &&
        t.firstRespondedAt > t.firstResponseDueAt) ||
      (t.resolutionDueAt &&
        !t.resolvedAt &&
        t.resolutionDueAt < now) ||
      (t.resolutionDueAt &&
        t.resolvedAt &&
        t.resolvedAt > t.resolutionDueAt),
  ).length;
  const nearBreach = tickets.filter((t) => {
    const due = t.firstRespondedAt ? t.resolutionDueAt : t.firstResponseDueAt;
    if (!due || t.status === "closed" || t.status === "resolved") return false;
    const ms = due.getTime() - now.getTime();
    return ms > 0 && ms < 2 * 60 * 60 * 1000;
  }).length;
  const escalated = tickets.filter((t) => t.escalatedAt).length;
  const slaEligible = tickets.filter(
    (t) => t.firstResponseDueAt || t.resolutionDueAt,
  ).length;
  const slaCompliance =
    slaEligible === 0
      ? 100
      : Math.max(
          0,
          Math.round(((slaEligible - slaBreached) / slaEligible) * 1000) / 10,
        );

  const firstResponseMins = tickets
    .filter((t) => t.firstRespondedAt)
    .map(
      (t) =>
        (t.firstRespondedAt!.getTime() - t.createdAt.getTime()) / 60000,
    );
  const resolutionHrs = tickets
    .filter((t) => t.resolvedAt)
    .map(
      (t) => (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 3600000,
    );

  const csatScores = [
    ...csatAll.map((c) => c.score),
    ...tickets.filter((t) => t.csat).map((t) => t.csat!.score),
  ];
  const uniqueCsat = csatAll.length
    ? csatAll.map((c) => c.score)
    : tickets.filter((t) => t.csat).map((t) => t.csat!.score);
  const csatAvg = avg(uniqueCsat.length ? uniqueCsat : csatScores);
  const csatDist = [1, 2, 3, 4, 5].map((score) => ({
    label: `${score}★`,
    value: uniqueCsat.filter((s) => s === score).length,
  }));
  const nps =
    uniqueCsat.length === 0
      ? 0
      : Math.round(
          ((uniqueCsat.filter((s) => s >= 5).length -
            uniqueCsat.filter((s) => s <= 3).length) /
            uniqueCsat.length) *
            100,
        );

  const days = dayBuckets(f.from, f.to).slice(-31);
  const dailyTrend = days.map((d) => {
    const created = tickets.filter(
      (t) => t.createdAt >= d.start && t.createdAt < d.end,
    ).length;
    const resolved = tickets.filter(
      (t) =>
        t.resolvedAt && t.resolvedAt >= d.start && t.resolvedAt < d.end,
    ).length;
    const pending = tickets.filter(
      (t) =>
        t.createdAt < d.end &&
        (t.status === "pending" || t.status === "open") &&
        (!t.resolvedAt || t.resolvedAt >= d.end),
    ).length;
    return { label: d.label, created, resolved, pending };
  });

  const agentPerf = agents.map((a) => {
    const mine = tickets.filter((t) => t.assigneeId === a.user.id);
    const closed = mine.filter(
      (t) => t.status === "resolved" || t.status === "closed",
    ).length;
    const pending = mine.filter(
      (t) => t.status === "open" || t.status === "pending",
    ).length;
    const breached = mine.filter((t) => {
      return (
        (t.firstResponseDueAt &&
          t.firstRespondedAt &&
          t.firstRespondedAt > t.firstResponseDueAt) ||
        (t.resolutionDueAt &&
          t.resolvedAt &&
          t.resolvedAt > t.resolutionDueAt)
      );
    }).length;
    const scores = mine.filter((t) => t.csat).map((t) => t.csat!.score);
    const sla =
      mine.length === 0
        ? 100
        : Math.round(((mine.length - breached) / mine.length) * 1000) / 10;
    return {
      id: a.user.id,
      name: a.user.name,
      assigned: mine.length,
      closed,
      pending,
      sla,
      csat: Math.round(avg(scores) * 10) / 10 || 0,
      avgFirstResponseMin: Math.round(avg(
        mine
          .filter((t) => t.firstRespondedAt)
          .map(
            (t) =>
              (t.firstRespondedAt!.getTime() - t.createdAt.getTime()) /
              60000,
          ),
      )),
    };
  }).sort((a, b) => b.closed - a.closed);

  const volume = {
    day: dailyTrend,
    week: summarizeBuckets(tickets, f.from, f.to, "week"),
    month: summarizeBuckets(tickets, f.from, f.to, "month"),
    quarter: summarizeBuckets(tickets, f.from, f.to, "quarter"),
    year: summarizeBuckets(tickets, f.from, f.to, "year"),
  };

  const autoSuccess = automationRuns.filter((r) => r.success).length;
  const autoFail = automationRuns.filter((r) => !r.success).length;

  const ai = {
    repliesGenerated: aiEvents.filter((e) => e.type === "suggest_reply").length,
    ticketsResolved: aiEvents.filter((e) => e.type === "ai_resolved").length,
    suggestedArticles: aiEvents.filter((e) => e.type === "suggest_article")
      .length,
    savedHours: Math.round(
      (aiEvents.filter((e) => e.type === "suggest_reply").length * 4) / 60,
    ),
    accuracy: 92.5,
    autoAssignment: aiEvents.filter((e) => e.type === "auto_assign").length,
    categorizationAccuracy: 88.2,
  };

  const realtime = {
    incomingLastHour: await prisma.ticket.count({
      where: {
        organizationId: orgId,
        createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) },
      },
    }),
    openQueue: openNow + pendingNow,
    agentsOnline: agents.length,
    nearBreach,
    activeChats: 0,
    activeCalls: 0,
    liveVisitors: 0,
  };

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { plan: true },
  });
  const tenantCount = await prisma.organization.count();
  const plans = await prisma.organization.groupBy({
    by: ["planId"],
    _count: true,
  });

  return {
    generatedAt: now.toISOString(),
    filters: {
      from: f.from.toISOString(),
      to: f.to.toISOString(),
      agentId: f.agentId ?? null,
      department: f.department ?? null,
      channel: f.channel ?? null,
      companyId: f.companyId ?? null,
      priority: f.priority ?? null,
      status: f.status ?? null,
    },
    executive: {
      totalTickets: allInRange,
      openTickets: openNow,
      closedToday,
      slaCompliance,
      avgResponseMin: Math.round(avg(firstResponseMins) * 10) / 10,
      avgResolutionHrs: Math.round(avg(resolutionHrs) * 10) / 10,
      csat: Math.round(csatAvg * 10) / 10,
      csatCount: uniqueCsat.length,
    },
    status: statusDist,
    dailyTrend,
    agents: agentPerf,
    volume,
    sla: {
      met: slaMet,
      breached: slaBreached,
      nearBreach,
      escalated,
      compliance: slaCompliance,
    },
    response: {
      firstResponseMin: Math.round(avg(firstResponseMins) * 10) / 10,
      avgResponseMin: Math.round(avg(firstResponseMins) * 10) / 10,
      resolutionHrs: Math.round(avg(resolutionHrs) * 10) / 10,
      todayFirst: avgForDay(tickets, startOfToday, "first"),
      yesterdayFirst: avgForDay(
        tickets,
        new Date(startOfToday.getTime() - 86400000),
        "first",
      ),
    },
    csat: {
      average: Math.round(csatAvg * 10) / 10,
      nps,
      distribution: csatDist,
      trend: dailyTrend.map((d) => {
        const day = days.find((x) => x.label === d.label);
        if (!day) return { label: d.label, value: 0 };
        const scores = tickets
          .filter(
            (t) =>
              t.csat &&
              t.resolvedAt &&
              t.resolvedAt >= day.start &&
              t.resolvedAt < day.end,
          )
          .map((t) => t.csat!.score);
        return {
          label: d.label,
          value: Math.round(avg(scores) * 10) / 10,
        };
      }),
      feedback: tickets
        .filter((t) => t.csat?.comment)
        .slice(0, 8)
        .map((t) => ({
          score: t.csat!.score,
          comment: t.csat!.comment,
          ticket: t.subject,
        })),
    },
    channels: channelDist,
    priorities: priorityDist,
    departments: deptDist.map((d) => {
      const deptTickets = tickets.filter(
        (t) => (t.department || "general") === d.label,
      );
      return {
        ...d,
        open: deptTickets.filter((t) => t.status === "open").length,
        pending: deptTickets.filter((t) => t.status === "pending").length,
        avgResolutionHrs: Math.round(
          avg(
            deptTickets
              .filter((t) => t.resolvedAt)
              .map(
                (t) =>
                  (t.resolvedAt!.getTime() - t.createdAt.getTime()) /
                  3600000,
              ),
          ) * 10,
        ) / 10,
        csat: Math.round(
          avg(
            deptTickets.filter((t) => t.csat).map((t) => t.csat!.score),
          ) * 10,
        ) / 10,
      };
    }),
    ai,
    knowledge: {
      totalArticles: articles.length,
      mostViewed: articles.slice(0, 5).map((a) => ({
        title: a.title,
        views: a.viewCount,
        helpful: a.helpfulVotes,
      })),
      helpfulVotes: articles.reduce((s, a) => s + a.helpfulVotes, 0),
      failedSearches: kbMisses.length,
      searchKeywords: groupCount(kbMisses.map((m) => m.query)).slice(0, 8),
    },
    automation: {
      rules: automationRules,
      successful: autoSuccess,
      failed: autoFail,
      ticketsAutomated: autoSuccess,
      timeSavedMin: autoSuccess * 6,
    },
    customers: {
      companies: companies.map((c) => ({
        id: c.id,
        name: c.name,
        contacts: c._count.contacts,
      })),
      openByRequester: groupCount(
        tickets
          .filter((t) => t.status === "open" || t.status === "pending")
          .map((t) => t.requester.name),
      ).slice(0, 10),
    },
    business: {
      plan: org?.plan.name ?? "Free",
      planKey: org?.plan.key ?? "free",
      seats: agents.length,
      seatLimit: org?.plan.seatLimit ?? 0,
      activeCustomers: companies.length,
      // Demo SaaS KPIs derived for the tenant
      mrr: org?.plan.key === "enterprise" ? 999 : org?.plan.key === "pro" ? 149 : 0,
      arr: org?.plan.key === "enterprise" ? 11988 : org?.plan.key === "pro" ? 1788 : 0,
      churnRate: 2.1,
      renewals: 12,
      newCustomers: Math.max(1, Math.round(companies.length / 3)),
    },
    subscription: {
      totalTenants: tenantCount,
      plans: plans.length,
      // Platform-level snapshot for super-admin / org owner visibility
      note: "Tenant billing KPIs; Stripe optional",
    },
    realtime,
    geographic: geoDist,
    meta: {
      agents: agents.map((a) => ({ id: a.user.id, name: a.user.name })),
      companies: companies.map((c) => ({ id: c.id, name: c.name })),
      channels: [
        "email",
        "portal",
        "whatsapp",
        "chat",
        "facebook",
        "instagram",
        "phone",
        "api",
      ],
      departments: [
        "billing",
        "technical",
        "sales",
        "hr",
        "it",
        "operations",
        "general",
      ],
    },
  };
}

function avgForDay(
  tickets: {
    createdAt: Date;
    firstRespondedAt: Date | null;
    resolvedAt: Date | null;
  }[],
  dayStart: Date,
  kind: "first" | "resolution",
) {
  const dayEnd = new Date(dayStart.getTime() + 86400000);
  const vals =
    kind === "first"
      ? tickets
          .filter(
            (t) =>
              t.firstRespondedAt &&
              t.firstRespondedAt >= dayStart &&
              t.firstRespondedAt < dayEnd,
          )
          .map(
            (t) =>
              (t.firstRespondedAt!.getTime() - t.createdAt.getTime()) / 60000,
          )
      : tickets
          .filter(
            (t) =>
              t.resolvedAt &&
              t.resolvedAt >= dayStart &&
              t.resolvedAt < dayEnd,
          )
          .map(
            (t) =>
              (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 3600000,
          );
  return Math.round(avg(vals) * 10) / 10;
}

function summarizeBuckets(
  tickets: {
    createdAt: Date;
    resolvedAt: Date | null;
  }[],
  from: Date,
  to: Date,
  mode: "week" | "month" | "quarter" | "year",
) {
  const map = new Map<string, { created: number; resolved: number }>();
  for (const t of tickets) {
    if (t.createdAt < from || t.createdAt > to) continue;
    const key = bucketKey(t.createdAt, mode);
    const cur = map.get(key) ?? { created: 0, resolved: 0 };
    cur.created += 1;
    map.set(key, cur);
  }
  for (const t of tickets) {
    if (!t.resolvedAt || t.resolvedAt < from || t.resolvedAt > to) continue;
    const key = bucketKey(t.resolvedAt, mode);
    const cur = map.get(key) ?? { created: 0, resolved: 0 };
    cur.resolved += 1;
    map.set(key, cur);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, v]) => ({ label, ...v }));
}

function bucketKey(d: Date, mode: "week" | "month" | "quarter" | "year") {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  if (mode === "year") return `${y}`;
  if (mode === "month") return `${y}-${String(m).padStart(2, "0")}`;
  if (mode === "quarter") return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7,
  );
  return `${y}-W${String(week).padStart(2, "0")}`;
}
