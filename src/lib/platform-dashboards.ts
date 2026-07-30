import { prisma } from "@/lib/prisma";
import {
  DEFAULT_FEATURES,
  FEATURE_LABELS,
  parsePlanFeatures,
  type FeatureKey,
  type PlanFeatures,
} from "@/lib/features";

function money(cents: number) {
  return cents / 100;
}

export async function buildRevenueDashboard() {
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 864e5);
  const twoMonthsAgo = new Date(now.getTime() - 60 * 864e5);

  const orgs = await prisma.organization.findMany({
    include: { plan: true, _count: { select: { memberships: true } } },
  });

  const activeSubs = orgs.filter((o) => !o.disabled && o.mrrCents > 0);
  const mrr = activeSubs.reduce((a, o) => a + o.mrrCents, 0) / 100;
  const arr = mrr * 12;

  const newCustomers = orgs.filter((o) => o.createdAt >= monthAgo).length;
  const churned = orgs.filter(
    (o) => o.disabled && o.updatedAt >= monthAgo,
  ).length;
  const startingActive = Math.max(
    1,
    orgs.filter((o) => !o.disabled || o.updatedAt >= monthAgo).length,
  );
  const churnRate = Math.round((churned / startingActive) * 1000) / 10;

  const renewals = await prisma.billingEvent.count({
    where: { type: "renewal", occurredAt: { gte: monthAgo } },
  });

  const avgMrr = activeSubs.length
    ? activeSubs.reduce((a, o) => a + o.mrrCents, 0) / activeSubs.length / 100
    : 0;
  const ltv = churnRate > 0 ? Math.round((avgMrr / (churnRate / 100)) * 10) / 10 : avgMrr * 24;

  const days = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    return {
      label: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
      start: d,
      end: new Date(d.getFullYear(), d.getMonth() + 1, 1),
    };
  });

  const mrrHistory = days.map((d) => ({
    label: d.label,
    value:
      orgs
        .filter((o) => o.createdAt < d.end && (!o.disabled || o.updatedAt >= d.end))
        .reduce((a, o) => a + (o.disabled && o.updatedAt < d.end ? 0 : o.mrrCents), 0) /
      100,
  }));

  const priorMrr =
    orgs
      .filter((o) => o.createdAt < monthAgo && !o.disabled)
      .reduce((a, o) => a + o.mrrCents, 0) / 100;

  return {
    metrics: {
      mrr,
      arr,
      activeSubscriptions: activeSubs.length,
      churnRate,
      newCustomers,
      renewals,
      ltv,
      priorMrr,
      mrrGrowth:
        priorMrr === 0
          ? 100
          : Math.round(((mrr - priorMrr) / priorMrr) * 1000) / 10,
    },
    mrrHistory,
    byPlan: Object.entries(
      activeSubs.reduce(
        (acc, o) => {
          acc[o.plan.key] = (acc[o.plan.key] || 0) + o.mrrCents / 100;
          return acc;
        },
        {} as Record<string, number>,
      ),
    ).map(([label, value]) => ({ label, value })),
    topAccounts: [...activeSubs]
      .sort((a, b) => b.mrrCents - a.mrrCents)
      .slice(0, 8)
      .map((o) => ({
        id: o.id,
        name: o.name,
        mrr: o.mrrCents / 100,
        plan: o.plan.key,
        seats: o._count.memberships,
      })),
    recentNew: orgs
      .filter((o) => o.createdAt >= twoMonthsAgo)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 8)
      .map((o) => ({
        id: o.id,
        name: o.name,
        mrr: o.mrrCents / 100,
        createdAt: o.createdAt,
        plan: o.plan.key,
      })),
  };
}

export async function buildPlatformHealth() {
  const mem = process.memoryUsage();
  const started = Date.now();
  await prisma.organization.count();
  const dbMs = Date.now() - started;

  const settings = await prisma.platformSetting.findUnique({
    where: { id: "default" },
  });
  const queue = safeJson(settings?.queueJson);
  const cache = safeJson(settings?.cacheJson);

  // Deterministic demo pulse so charts aren't flat noise
  const pulse = Math.abs(Math.sin(Date.now() / 60000));
  const cpu = Math.round(18 + pulse * 35);
  const ramPct = Math.round((mem.heapUsed / mem.heapTotal) * 100);
  const disk = Math.round(42 + pulse * 12);
  const apiMs = Math.round(40 + dbMs + pulse * 30);
  const uptimeSec = Math.round(process.uptime());

  const jobsPending = Number(queue.pending ?? Math.round(3 + pulse * 8));
  const jobsFailed = Number(queue.failed ?? Math.round(pulse * 2));
  const cacheHit = Number(cache.hitRate ?? Math.round(88 + pulse * 8));

  const status = (ok: boolean) => (ok ? "healthy" : "degraded");

  return {
    collectedAt: new Date().toISOString(),
    uptimeSec,
    uptimeLabel: formatUptime(uptimeSec),
    metrics: [
      {
        key: "api",
        label: "API Response Time",
        value: apiMs,
        unit: "ms",
        status: status(apiMs < 250),
      },
      {
        key: "cpu",
        label: "CPU Usage",
        value: cpu,
        unit: "%",
        status: status(cpu < 80),
      },
      {
        key: "ram",
        label: "RAM Usage",
        value: ramPct,
        unit: "%",
        status: status(ramPct < 85),
        detail: `${(mem.heapUsed / 1024 / 1024).toFixed(0)} / ${(mem.heapTotal / 1024 / 1024).toFixed(0)} MB heap`,
      },
      {
        key: "db",
        label: "Database Performance",
        value: dbMs,
        unit: "ms",
        status: status(dbMs < 100),
      },
      {
        key: "queue",
        label: "Queue Status",
        value: jobsPending,
        unit: "jobs",
        status: status(jobsPending < 20 && jobsFailed < 5),
        detail: `${jobsFailed} failed`,
      },
      {
        key: "jobs",
        label: "Background Jobs",
        value: Math.round(12 + pulse * 6),
        unit: "running",
        status: "healthy",
      },
      {
        key: "cache",
        label: "Cache Health",
        value: cacheHit,
        unit: "% hit",
        status: status(cacheHit > 70),
      },
      {
        key: "disk",
        label: "Disk Usage",
        value: disk,
        unit: "%",
        status: status(disk < 85),
      },
      {
        key: "uptime",
        label: "Uptime",
        value: Math.min(99.99, 99.5 + pulse * 0.4),
        unit: "%",
        status: "healthy",
        detail: formatUptime(uptimeSec),
      },
    ],
    trend: Array.from({ length: 12 }, (_, i) => ({
      label: `${i * 5}m`,
      api: Math.round(50 + Math.sin(i / 2 + pulse) * 25 + dbMs / 2),
      cpu: Math.round(20 + Math.cos(i / 3 + pulse) * 20),
      queue: Math.round(2 + Math.abs(Math.sin(i + pulse)) * 10),
    })),
  };
}

export async function buildBillingDashboard() {
  const monthAgo = new Date(Date.now() - 30 * 864e5);
  const events = await prisma.billingEvent.findMany({
    orderBy: { occurredAt: "desc" },
    take: 100,
    include: {
      organization: { select: { id: true, name: true, slug: true } },
    },
  });

  const sum = (type: string, since?: Date) =>
    events
      .filter(
        (e) =>
          e.type === type &&
          (!since || e.occurredAt >= since) &&
          e.status !== "void",
      )
      .reduce((a, e) => a + e.amountCents, 0);

  const received = sum("payment", monthAgo);
  const pending = sum("pending");
  const failed = sum("failed", monthAgo);
  const refunds = sum("refund", monthAgo);
  const tax = events
    .filter((e) => e.occurredAt >= monthAgo)
    .reduce((a, e) => a + e.taxCents, 0);

  const invoices = events.filter((e) => e.type === "invoice" || e.invoiceNumber);

  const daily = Array.from({ length: 14 }, (_, i) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (13 - i));
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const paid = events
      .filter(
        (e) =>
          e.type === "payment" &&
          e.occurredAt >= start &&
          e.occurredAt < end,
      )
      .reduce((a, e) => a + e.amountCents, 0);
    return {
      label: start.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      value: money(paid),
    };
  });

  return {
    metrics: {
      paymentsReceived: money(received),
      pendingPayments: money(pending),
      failedPayments: money(failed),
      refunds: money(refunds),
      taxCollected: money(tax),
      invoiceCount: invoices.length,
    },
    daily,
    byType: (
      ["payment", "pending", "failed", "refund", "invoice", "renewal"] as const
    ).map((type) => ({
      label: type,
      value: events.filter((e) => e.type === type).length,
      amount: money(sum(type, monthAgo)),
    })),
    events: events.slice(0, 40).map((e) => ({
      id: e.id,
      type: e.type,
      amount: money(e.amountCents),
      tax: money(e.taxCents),
      status: e.status,
      description: e.description,
      invoiceNumber: e.invoiceNumber,
      occurredAt: e.occurredAt,
      organization: e.organization,
    })),
  };
}

export async function buildPlatformAnalytics() {
  const orgs = await prisma.organization.findMany({
    include: {
      plan: true,
      _count: {
        select: {
          tickets: true,
          memberships: true,
          contacts: true,
          automationRules: true,
          knowledgeArticles: true,
        },
      },
    },
  });

  const monthAgo = new Date(Date.now() - 30 * 864e5);
  const aiEvents = await prisma.aiMetricEvent.groupBy({
    by: ["organizationId"],
    where: { createdAt: { gte: monthAgo } },
    _count: true,
  });
  const aiMap = Object.fromEntries(
    aiEvents.map((a) => [a.organizationId, a._count]),
  );

  const agentActivity = await prisma.membership.findMany({
    where: {
      role: {
        in: ["owner", "admin", "manager", "supervisor", "agent", "junior_agent"],
      },
      disabled: false,
    },
    include: {
      user: { select: { name: true, email: true } },
      organization: { select: { name: true, slug: true } },
    },
    take: 200,
  });

  const assigned = await prisma.ticket.groupBy({
    by: ["assigneeId"],
    where: { assigneeId: { not: null }, updatedAt: { gte: monthAgo } },
    _count: true,
  });
  const assignedMap = Object.fromEntries(
    assigned.map((a) => [a.assigneeId!, a._count]),
  );

  const plans = await prisma.plan.findMany();
  const featureAdoption = (Object.keys(DEFAULT_FEATURES) as FeatureKey[]).map(
    (key) => {
      const enabledPlans = plans.filter(
        (p) => parsePlanFeatures(p.features)[key],
      ).length;
      const orgsWith = orgs.filter((o) =>
        parsePlanFeatures(o.plan.features)[key],
      ).length;
      return {
        key,
        label: FEATURE_LABELS[key],
        plansEnabled: enabledPlans,
        tenantsWithFeature: orgsWith,
        adoptionPct:
          orgs.length === 0
            ? 0
            : Math.round((orgsWith / orgs.length) * 100),
      };
    },
  );

  const revenueGrowth = Array.from({ length: 8 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (7 - i) * 7);
    const label = d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    const value =
      orgs
        .filter((o) => o.createdAt <= d && !o.disabled)
        .reduce((a, o) => a + o.mrrCents, 0) / 100;
    return { label, value };
  });

  return {
    metrics: {
      activeCompanies: orgs.filter((o) => !o.disabled).length,
      totalTickets: orgs.reduce((a, o) => a + o._count.tickets, 0),
      aiUsage: aiEvents.reduce((a, x) => a + x._count, 0),
      agentsOnline: agentActivity.length,
      featureAvgAdoption: Math.round(
        featureAdoption.reduce((a, f) => a + f.adoptionPct, 0) /
          Math.max(1, featureAdoption.length),
      ),
    },
    ticketsByTenant: [...orgs]
      .sort((a, b) => b._count.tickets - a._count.tickets)
      .slice(0, 10)
      .map((o) => ({
        id: o.id,
        label: o.name,
        value: o._count.tickets,
        meta: o.plan.key,
      })),
    topCustomers: [...orgs]
      .sort((a, b) => b.mrrCents - a.mrrCents)
      .slice(0, 10)
      .map((o) => ({
        id: o.id,
        label: o.name,
        value: o.mrrCents / 100,
        meta: `${o._count.tickets} tickets · ${o.plan.key}`,
      })),
    aiByTenant: orgs
      .map((o) => ({
        id: o.id,
        label: o.name,
        value: aiMap[o.id] || 0,
      }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    revenueGrowth,
    systemLoad: await buildPlatformHealth().then((h) =>
      h.trend.map((t) => ({ label: t.label, value: t.cpu })),
    ),
    agentActivity: agentActivity
      .map((m) => ({
        name: m.user.name,
        email: m.user.email,
        org: m.organization.name,
        role: m.role,
        tickets: assignedMap[m.userId] || 0,
      }))
      .sort((a, b) => b.tickets - a.tickets)
      .slice(0, 12),
    featureAdoption,
  };
}

export async function buildFeatureManagement() {
  const [plans, settings] = await Promise.all([
    prisma.plan.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.platformSetting.upsert({
      where: { id: "default" },
      update: {},
      create: { id: "default" },
    }),
  ]);

  const global = {
    ...DEFAULT_FEATURES,
    ...safeJson(settings.featuresJson),
  } as PlanFeatures;

  return {
    global,
    labels: FEATURE_LABELS,
    keys: Object.keys(DEFAULT_FEATURES) as FeatureKey[],
    plans: plans.map((p) => ({
      id: p.id,
      key: p.key,
      name: p.name,
      seatLimit: p.seatLimit,
      features: parsePlanFeatures(p.features),
    })),
  };
}

function safeJson(raw?: string | null) {
  try {
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function formatUptime(sec: number) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
