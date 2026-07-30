import { prisma } from "@/lib/prisma";
import { ASSIGNABLE_ROLES } from "@/lib/permissions";

export async function buildTenantBusinessSnapshot(organizationId: string) {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    org,
    openTickets,
    pendingTickets,
    closedWeek,
    createdWeek,
    createdMonth,
    seats,
    customers,
    companies,
    articles,
    automations,
    csat,
    slaBreached,
    byStatus,
    byPriority,
    byChannel,
    byDepartment,
    roleBreakdown,
    recentTickets,
    recentAudit,
  ] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        plan: true,
        businessHours: true,
        _count: {
          select: {
            memberships: true,
            tickets: true,
            contacts: true,
            companies: true,
            knowledgeArticles: true,
            automationRules: true,
            invites: true,
            slaPolicies: true,
            tags: true,
            macros: true,
            cannedResponses: true,
          },
        },
        memberships: {
          include: {
            user: {
              select: { id: true, name: true, email: true, createdAt: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.ticket.count({
      where: { organizationId, status: "open" },
    }),
    prisma.ticket.count({
      where: { organizationId, status: "pending" },
    }),
    prisma.ticket.count({
      where: {
        organizationId,
        status: { in: ["resolved", "closed"] },
        updatedAt: { gte: weekAgo },
      },
    }),
    prisma.ticket.count({
      where: { organizationId, createdAt: { gte: weekAgo } },
    }),
    prisma.ticket.count({
      where: { organizationId, createdAt: { gte: monthAgo } },
    }),
    prisma.membership.count({
      where: {
        organizationId,
        disabled: false,
        role: { in: ASSIGNABLE_ROLES },
      },
    }),
    prisma.membership.count({
      where: {
        organizationId,
        role: { in: ["customer", "customer_manager", "guest"] },
      },
    }),
    prisma.company.count({ where: { organizationId } }),
    prisma.knowledgeArticle.count({
      where: { organizationId, published: true },
    }),
    prisma.automationRule.count({
      where: { organizationId, enabled: true },
    }),
    prisma.csatRating.findMany({
      where: { organizationId, createdAt: { gte: monthAgo } },
      select: { score: true },
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
    prisma.ticket.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: true,
    }),
    prisma.ticket.groupBy({
      by: ["priority"],
      where: { organizationId },
      _count: true,
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
    prisma.membership.groupBy({
      by: ["role"],
      where: { organizationId },
      _count: true,
    }),
    prisma.ticket.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true,
        subject: true,
        status: true,
        priority: true,
        channel: true,
        department: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { actor: { select: { email: true, name: true } } },
    }),
  ]);

  if (!org) return null;

  const csatAvg =
    csat.length === 0
      ? null
      : Math.round((csat.reduce((a, c) => a + c.score, 0) / csat.length) * 10) /
        10;

  const seatLimit = org.plan.seatLimit;
  const seatUtilization =
    seatLimit > 0 ? Math.round((seats / seatLimit) * 100) : 0;

  let health = org.healthScore;
  if (org.disabled) health = Math.min(health, 20);
  if (slaBreached > 5) health = Math.min(health, 55);
  if (seatUtilization > 90) health = Math.min(health, 70);
  if (org.trialEndsAt && org.trialEndsAt < now) health = Math.min(health, 40);

  return {
    organization: org,
    usage: {
      openTickets,
      pendingTickets,
      closedWeek,
      createdWeek,
      createdMonth,
      seats,
      seatLimit,
      seatUtilization,
      customers,
      companies,
      publishedArticles: articles,
      activeAutomations: automations,
      csatAvg,
      csatSamples: csat.length,
      slaBreached,
      storageMb: Math.round((org.storageUsedBytes / 1024 / 1024) * 10) / 10,
      mrr: org.mrrCents / 100,
      healthScore: health,
      createdDay: await prisma.ticket.count({
        where: { organizationId, createdAt: { gte: dayAgo } },
      }),
    },
    breakdowns: {
      byStatus: byStatus.map((r) => ({
        label: r.status,
        value: r._count,
      })),
      byPriority: byPriority.map((r) => ({
        label: r.priority,
        value: r._count,
      })),
      byChannel: byChannel.map((r) => ({
        label: r.channel || "unknown",
        value: r._count,
      })),
      byDepartment: byDepartment.map((r) => ({
        label: r.department || "general",
        value: r._count,
      })),
      byRole: roleBreakdown.map((r) => ({
        label: r.role,
        value: r._count,
      })),
    },
    recentTickets,
    recentAudit,
  };
}

export async function buildPlatformBusinessReport() {
  const orgs = await prisma.organization.findMany({
    include: {
      plan: true,
      _count: { select: { tickets: true, memberships: true, contacts: true } },
    },
  });

  const group = <T extends string>(key: (o: (typeof orgs)[0]) => T) => {
    const map: Record<string, { count: number; tickets: number; mrr: number }> =
      {};
    for (const o of orgs) {
      const k = key(o) || "unspecified";
      if (!map[k]) map[k] = { count: 0, tickets: 0, mrr: 0 };
      map[k].count += 1;
      map[k].tickets += o._count.tickets;
      map[k].mrr += o.mrrCents / 100;
    }
    return Object.entries(map)
      .map(([label, v]) => ({ label, ...v }))
      .sort((a, b) => b.count - a.count);
  };

  const totalMrr = orgs.reduce((a, o) => a + o.mrrCents, 0) / 100;
  const active = orgs.filter((o) => !o.disabled).length;
  const trial = orgs.filter(
    (o) => o.trialEndsAt && o.trialEndsAt > new Date(),
  ).length;
  const suspended = orgs.filter((o) => o.disabled).length;

  const now = new Date();
  const days: { start: Date; end: Date; label: string }[] = [];
  for (let i = 13; i >= 0; i--) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - i);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    days.push({
      start,
      end,
      label: start.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    });
  }

  const ticketsLast14 = await prisma.ticket.findMany({
    where: { createdAt: { gte: days[0]!.start } },
    select: { createdAt: true, organizationId: true, status: true },
  });

  const ticketTrend = days.map((d) => ({
    label: d.label,
    created: ticketsLast14.filter(
      (t) => t.createdAt >= d.start && t.createdAt < d.end,
    ).length,
    tenantsActive: new Set(
      ticketsLast14
        .filter((t) => t.createdAt >= d.start && t.createdAt < d.end)
        .map((t) => t.organizationId),
    ).size,
  }));

  const tenantGrowth = days.map((d) => ({
    label: d.label,
    value: orgs.filter((o) => o.createdAt < d.end).length,
  }));

  const mrrTrend = days.map((d) => ({
    label: d.label,
    value:
      orgs
        .filter((o) => !o.disabled && o.createdAt < d.end)
        .reduce((a, o) => a + o.mrrCents, 0) / 100,
  }));

  const healthBuckets = [
    { label: "90-100", min: 90, max: 101 },
    { label: "70-89", min: 70, max: 90 },
    { label: "50-69", min: 50, max: 70 },
    { label: "0-49", min: 0, max: 50 },
  ].map((b) => ({
    label: b.label,
    value: orgs.filter((o) => o.healthScore >= b.min && o.healthScore < b.max)
      .length,
  }));

  const topByMrr = [...orgs]
    .sort((a, b) => b.mrrCents - a.mrrCents)
    .slice(0, 8)
    .map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      value: o.mrrCents / 100,
      plan: o.plan.key,
      health: o.healthScore,
    }));

  const topByTickets = [...orgs]
    .sort((a, b) => b._count.tickets - a._count.tickets)
    .slice(0, 8)
    .map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      value: o._count.tickets,
      plan: o.plan.key,
      openHint: o._count.tickets,
    }));

  const atRisk = orgs
    .filter(
      (o) =>
        o.disabled ||
        o.healthScore < 60 ||
        (o.trialEndsAt &&
          o.trialEndsAt.getTime() - now.getTime() < 7 * 864e5 &&
          o.trialEndsAt > now),
    )
    .map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      reason: o.disabled
        ? "Suspended"
        : o.healthScore < 60
          ? `Low health (${o.healthScore})`
          : "Trial ending soon",
      health: o.healthScore,
      mrr: o.mrrCents / 100,
    }));

  return {
    totals: {
      tenants: orgs.length,
      active,
      suspended,
      trial,
      totalMrr,
      totalTickets: orgs.reduce((a, o) => a + o._count.tickets, 0),
      totalMembers: orgs.reduce((a, o) => a + o._count.memberships, 0),
      avgHealth:
        orgs.length === 0
          ? 0
          : Math.round(
              orgs.reduce((a, o) => a + o.healthScore, 0) / orgs.length,
            ),
      ticketsToday: ticketTrend[ticketTrend.length - 1]?.created ?? 0,
      arr: totalMrr * 12,
    },
    groups: {
      byPlan: group((o) => o.plan.key),
      byIndustry: group((o) => o.industry || "unspecified"),
      byCountry: group((o) => o.country || "unspecified"),
      bySegment: group((o) => o.segment || "unspecified"),
      byCompanySize: group((o) => o.companySize || "unspecified"),
      byStatus: group((o) => (o.disabled ? "suspended" : "active")),
      byWhiteLabel: group((o) => (o.whiteLabel ? "white-label" : "standard")),
    },
    charts: {
      ticketTrend,
      tenantGrowth,
      mrrTrend,
      healthBuckets,
      topByMrr,
      topByTickets,
      atRisk,
    },
  };
}
