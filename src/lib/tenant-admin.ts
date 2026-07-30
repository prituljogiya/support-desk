import { prisma } from "@/lib/prisma";
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@/lib/permissions";
import { parsePlanFeatures } from "@/lib/features";

export async function buildTenantAdminSnapshot(organizationId: string) {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      plan: true,
      businessHours: true,
      _count: {
        select: {
          tickets: true,
          memberships: true,
          contacts: true,
          companies: true,
          knowledgeArticles: true,
          automationRules: true,
          slaPolicies: true,
        },
      },
    },
  });
  if (!org) return null;

  const [
    open,
    pending,
    resolved,
    closed,
    createdToday,
    resolvedToday,
    overdue,
    escalated,
    unassigned,
    agents,
    memberships,
    csat,
    articlesViews,
    automationRuns,
    aiEvents,
    byChannel,
    byDepartment,
    byStatus,
    recentTickets,
    companies,
    contacts,
    slaPolicies,
    automationRules,
    articles,
    auditLogs,
  ] = await Promise.all([
    prisma.ticket.count({ where: { organizationId, status: "open" } }),
    prisma.ticket.count({ where: { organizationId, status: "pending" } }),
    prisma.ticket.count({ where: { organizationId, status: "resolved" } }),
    prisma.ticket.count({ where: { organizationId, status: "closed" } }),
    prisma.ticket.count({
      where: { organizationId, createdAt: { gte: startOfToday } },
    }),
    prisma.ticket.count({
      where: {
        organizationId,
        status: { in: ["resolved", "closed"] },
        updatedAt: { gte: startOfToday },
      },
    }),
    prisma.ticket.count({
      where: {
        organizationId,
        status: { in: ["open", "pending"] },
        OR: [
          { firstResponseDueAt: { lt: now }, firstRespondedAt: null },
          { resolutionDueAt: { lt: now } },
        ],
      },
    }),
    prisma.ticket.count({
      where: { organizationId, escalatedAt: { not: null } },
    }),
    prisma.ticket.count({
      where: {
        organizationId,
        assigneeId: null,
        status: { in: ["open", "pending"] },
      },
    }),
    prisma.membership.count({
      where: {
        organizationId,
        disabled: false,
        role: { in: ASSIGNABLE_ROLES },
      },
    }),
    prisma.membership.findMany({
      where: { organizationId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.csatRating.findMany({
      where: { organizationId },
      select: { score: true },
      take: 500,
    }),
    prisma.knowledgeArticle.aggregate({
      where: { organizationId },
      _sum: { viewCount: true, helpfulVotes: true },
    }),
    prisma.automationRun.findMany({
      where: { organizationId },
      take: 100,
      orderBy: { createdAt: "desc" },
    }),
    prisma.aiMetricEvent.count({
      where: {
        organizationId,
        createdAt: { gte: new Date(now.getTime() - 30 * 864e5) },
      },
    }),
    prisma.ticket.groupBy({
      by: ["channel"],
      where: { organizationId },
      _count: true,
    }),
    prisma.ticket.groupBy({
      by: ["department"],
      where: { organizationId },
      _count: true,
    }),
    prisma.ticket.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: true,
    }),
    prisma.ticket.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: {
        id: true,
        subject: true,
        status: true,
        priority: true,
        channel: true,
        department: true,
        assigneeId: true,
        escalatedAt: true,
        updatedAt: true,
      },
    }),
    prisma.company.findMany({
      where: { organizationId },
      take: 50,
      orderBy: { name: "asc" },
      include: { _count: { select: { contacts: true } } },
    }),
    prisma.contact.findMany({
      where: { organizationId },
      take: 50,
      orderBy: { updatedAt: "desc" },
      include: { company: { select: { name: true } } },
    }),
    prisma.slaPolicy.findMany({ where: { organizationId } }),
    prisma.automationRule.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.knowledgeArticle.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        published: true,
        category: true,
        viewCount: true,
        helpfulVotes: true,
      },
    }),
    prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { actor: { select: { email: true, name: true } } },
    }),
  ]);

  const csatAvg =
    csat.length === 0
      ? null
      : Math.round((csat.reduce((a, c) => a + c.score, 0) / csat.length) * 10) /
        10;

  const withSla = await prisma.ticket.count({
    where: {
      organizationId,
      OR: [
        { firstResponseDueAt: { not: null } },
        { resolutionDueAt: { not: null } },
      ],
    },
  });
  const slaCompliance =
    withSla === 0
      ? 100
      : Math.round(((withSla - overdue) / withSla) * 1000) / 10;

  const responseSamples = await prisma.ticket.findMany({
    where: {
      organizationId,
      firstRespondedAt: { not: null },
    },
    select: { createdAt: true, firstRespondedAt: true, resolvedAt: true },
    take: 200,
  });
  const firstResponseMins = responseSamples
    .filter((t) => t.firstRespondedAt)
    .map(
      (t) =>
        (t.firstRespondedAt!.getTime() - t.createdAt.getTime()) / 60000,
    );
  const resolutionHrs = responseSamples
    .filter((t) => t.resolvedAt)
    .map(
      (t) => (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 3600000,
    );
  const avg = (nums: number[]) =>
    nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;

  const features = parsePlanFeatures(org.plan.features);
  const seatLimit = org.plan.seatLimit;

  const departments = [
    ...new Set(
      [
        ...byDepartment.map((d) => d.department || "general"),
        "technical",
        "billing",
        "sales",
        "hr",
        "it",
      ].filter(Boolean),
    ),
  ];

  const teams = [
    {
      id: "team-a",
      name: "Team A",
      department: "technical",
      agents: Math.ceil(agents / 3),
    },
    {
      id: "team-b",
      name: "Team B",
      department: "billing",
      agents: Math.ceil(agents / 4),
    },
    {
      id: "night",
      name: "Night Shift",
      department: "technical",
      agents: Math.max(1, Math.floor(agents / 5)),
    },
    {
      id: "escalation",
      name: "Escalation Team",
      department: "technical",
      agents: Math.max(1, Math.floor(agents / 6)),
    },
  ];

  return {
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      brandColor: org.brandColor,
      logoUrl: org.logoUrl,
      customDomain: org.customDomain,
      industry: org.industry,
      country: org.country,
      timezone: org.businessHours?.timezone || "UTC",
      plan: {
        key: org.plan.key,
        name: org.plan.name,
        seatLimit,
        features,
      },
      storageUsedBytes: org.storageUsedBytes,
    },
    kpis: {
      totalTickets: org._count.tickets,
      openTickets: open,
      pendingTickets: pending,
      resolvedTickets: resolved,
      closedTickets: closed,
      overdueTickets: overdue,
      todaysTickets: createdToday,
      resolvedToday,
      escalated,
      unassigned,
      slaCompliance,
      firstResponseMins: Math.round(avg(firstResponseMins) * 10) / 10,
      resolutionHrs: Math.round(avg(resolutionHrs) * 10) / 10,
      csat: csatAvg,
      activeAgents: agents,
      liveChats: byChannel.find((c) => c.channel === "chat")?._count ?? 0,
      knowledgeViews: articlesViews._sum.viewCount ?? 0,
      helpfulVotes: articlesViews._sum.helpfulVotes ?? 0,
      aiEvents30d: aiEvents,
      seatsUsed: agents,
      seatLimit,
    },
    breakdowns: {
      byStatus: byStatus.map((r) => ({ label: r.status, value: r._count })),
      byChannel: byChannel.map((r) => ({
        label: r.channel || "unknown",
        value: r._count,
      })),
      byDepartment: byDepartment.map((r) => ({
        label: r.department || "general",
        value: r._count,
      })),
    },
    members: memberships.map((m) => ({
      id: m.id,
      role: m.role,
      roleLabel: ROLE_LABELS[m.role] || m.role,
      disabled: m.disabled,
      user: m.user,
    })),
    departments: departments.map((d) => ({
      id: d,
      name: d.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      tickets: byDepartment.find((x) => (x.department || "general") === d)
        ?._count ?? 0,
    })),
    teams,
    companies,
    contacts: contacts.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      company: c.company?.name || null,
    })),
    recentTickets,
    slaPolicies,
    automationRules,
    automationRuns: {
      successful: automationRuns.filter((r) => r.success).length,
      failed: automationRuns.filter((r) => !r.success).length,
      recent: automationRuns.slice(0, 10),
    },
    articles,
    auditLogs: auditLogs.map((l) => ({
      id: l.id,
      action: l.action,
      createdAt: l.createdAt,
      actor: l.actor,
    })),
    widgets: {
      ticketTrend: await buildWeekTrend(organizationId),
      agentLeaderboard: await buildAgentLeaderboard(organizationId),
    },
  };
}

async function buildWeekTrend(organizationId: string) {
  const now = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - i);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const created = await prisma.ticket.count({
      where: { organizationId, createdAt: { gte: start, lt: end } },
    });
    const resolved = await prisma.ticket.count({
      where: {
        organizationId,
        status: { in: ["resolved", "closed"] },
        updatedAt: { gte: start, lt: end },
      },
    });
    days.push({
      label: start.toLocaleDateString(undefined, {
        weekday: "short",
      }),
      created,
      resolved,
    });
  }
  return days;
}

async function buildAgentLeaderboard(organizationId: string) {
  const closed = await prisma.ticket.groupBy({
    by: ["assigneeId"],
    where: {
      organizationId,
      assigneeId: { not: null },
      status: { in: ["resolved", "closed"] },
    },
    _count: true,
  });
  const ids = closed.map((c) => c.assigneeId!).filter(Boolean);
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  const nameMap = Object.fromEntries(users.map((u) => [u.id, u.name]));
  return closed
    .map((c) => ({
      id: c.assigneeId!,
      label: nameMap[c.assigneeId!] || "Agent",
      value: c._count,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}
