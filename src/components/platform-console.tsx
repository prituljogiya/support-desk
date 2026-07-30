"use client";

import { useEffect, useMemo, useState } from "react";
import { ROLE_LABELS, ROLE_PERMISSIONS, PERMISSIONS } from "@/lib/permissions";
import type { MembershipRole } from "@prisma/client";
import {
  AreaTrend,
  HealthGauge,
  HorizontalRank,
  InteractiveBars,
  InteractiveDonut,
  KpiCard,
  colorAt,
} from "@/components/platform-charts";
import { PlatformDashboardsPanel } from "@/components/platform-dashboards-panel";
import { PlatformSectionPanel } from "@/components/platform-section-panels";
import { INDUSTRIES } from "@/lib/sectors";
import {
  PLATFORM_FOOTER_NAV,
  PLATFORM_NAV,
  labelForNav,
  type PlatformNavId,
} from "@/lib/platform-nav";

type Tab = PlatformNavId;

type Org = {
  id: string;
  name: string;
  slug: string;
  disabled: boolean;
  customDomain: string | null;
  whiteLabel: boolean;
  storageUsedBytes: number;
  industry: string | null;
  companySize: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  billingEmail: string | null;
  billingContact: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  segment: string | null;
  mrrCents: number;
  healthScore: number;
  trialEndsAt: string | null;
  contractEndsAt: string | null;
  brandColor: string | null;
  logoUrl: string | null;
  openTickets?: number;
  createdAt: string;
  plan: { key: string; name: string; seatLimit: number };
  _count: {
    memberships: number;
    tickets: number;
    contacts?: number;
    companies?: number;
    knowledgeArticles?: number;
    automationRules?: number;
  };
  memberships: {
    user: { id: string; email: string; name: string };
  }[];
};

type GroupRow = { label: string; count: number; tickets: number; mrr: number };

type BusinessReport = {
  totals: {
    tenants: number;
    active: number;
    suspended: number;
    trial: number;
    totalMrr: number;
    totalTickets: number;
    totalMembers: number;
    avgHealth: number;
    ticketsToday?: number;
    arr?: number;
  };
  groups: Record<string, GroupRow[]>;
  charts?: {
    ticketTrend: { label: string; created: number; tenantsActive: number }[];
    tenantGrowth: { label: string; value: number }[];
    mrrTrend: { label: string; value: number }[];
    healthBuckets: { label: string; value: number }[];
    topByMrr: {
      id: string;
      name: string;
      slug: string;
      value: number;
      plan: string;
      health: number;
    }[];
    topByTickets: {
      id: string;
      name: string;
      slug: string;
      value: number;
      plan: string;
    }[];
    atRisk: {
      id: string;
      name: string;
      slug: string;
      reason: string;
      health: number;
      mrr: number;
    }[];
  };
};

type TenantDetail = {
  organization: Omit<Org, "memberships" | "_count"> & {
    memberships: {
      id: string;
      role: MembershipRole;
      disabled: boolean;
      user: { id: string; name: string; email: string };
    }[];
    _count: Org["_count"] & {
      invites?: number;
      slaPolicies?: number;
      tags?: number;
      macros?: number;
      cannedResponses?: number;
    };
  };
  usage: {
    openTickets: number;
    pendingTickets: number;
    closedWeek: number;
    createdWeek: number;
    createdMonth: number;
    seats: number;
    seatLimit: number;
    seatUtilization: number;
    customers: number;
    companies: number;
    publishedArticles: number;
    activeAutomations: number;
    csatAvg: number | null;
    csatSamples: number;
    slaBreached: number;
    storageMb: number;
    mrr: number;
    healthScore: number;
    createdDay: number;
  };
  breakdowns: {
    byStatus: { label: string; value: number }[];
    byPriority: { label: string; value: number }[];
    byChannel: { label: string; value: number }[];
    byDepartment: { label: string; value: number }[];
    byRole: { label: string; value: number }[];
  };
  recentTickets: {
    id: string;
    subject: string;
    status: string;
    priority: string;
    channel: string | null;
    department: string | null;
    updatedAt: string;
  }[];
  recentAudit: {
    id: string;
    action: string;
    createdAt: string;
    actor?: { email: string; name: string } | null;
  }[];
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
  memberships: {
    id: string;
    role: MembershipRole;
    disabled: boolean;
    organization: { name: string; slug: string };
  }[];
};

const TABS: { id: Tab; label: string }[] = []; // replaced by PLATFORM_NAV sidebar

const SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"];
const SEGMENTS = ["startup", "smb", "mid-market", "enterprise", "nonprofit"];

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function Bars({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <div className="text-xs font-semibold text-slate-700">{title}</div>
      <ul className="mt-2 space-y-1.5">
        {rows.length === 0 ? (
          <li className="text-xs text-slate-400">No data</li>
        ) : (
          rows.map((r) => (
            <li key={r.label} className="text-xs">
              <div className="mb-0.5 flex justify-between text-slate-600">
                <span>{r.label}</span>
                <span>{r.value}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded bg-slate-200">
                <div
                  className="h-full rounded bg-sky-600"
                  style={{ width: `${(r.value / max) * 100}%` }}
                />
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function PlatformConsole({
  email,
  name,
}: {
  email: string;
  name?: string;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [navOpen, setNavOpen] = useState<Record<string, boolean>>({
    dashboard: true,
    tenants: true,
    subscription: true,
    users: true,
    reports: true,
    ai: true,
    platform: true,
    security: true,
    backup: true,
  });
  const [data, setData] = useState<{
    organizations: Org[];
    plans: {
      key: string;
      name: string;
      seatLimit: number;
      description: string | null;
    }[];
    coupons: { id: string; code: string; percentOff: number; active: boolean }[];
    settings: Record<string, string>;
    auditLogs: {
      id: string;
      action: string;
      createdAt: string;
      actor?: { email: string; name: string } | null;
      organization?: { name: string; slug: string } | null;
    }[];
    users: UserRow[];
    businessReport?: BusinessReport;
  } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [groupBy, setGroupBy] = useState<
    "byPlan" | "byIndustry" | "byCountry" | "bySegment" | "byCompanySize" | "byStatus"
  >("byPlan");
  const [filter, setFilter] = useState({
    q: "",
    plan: "all",
    status: "all",
    industry: "all",
    segment: "all",
    country: "all",
  });

  const [createOrg, setCreateOrg] = useState({
    name: "",
    planKey: "pro",
    ownerEmail: "",
    ownerName: "",
    ownerPassword: "password123",
    customDomain: "",
    whiteLabel: false,
    industry: "SaaS",
    companySize: "11-50",
    country: "US",
    segment: "smb",
    mrrCents: 9900,
    billingEmail: "",
  });
  const [coupon, setCoupon] = useState({ code: "", percentOff: 20 });
  const [newUser, setNewUser] = useState({
    email: "",
    name: "",
    password: "password123",
    isSuperAdmin: false,
  });
  const [edit, setEdit] = useState<Record<string, string | number | boolean>>({});

  async function load() {
    const res = await fetch("/api/platform/orgs");
    const json = await res.json();
    if (res.ok) setData(json);
  }

  async function loadDetail(organizationId: string) {
    setBusy(true);
    const res = await fetch(
      `/api/platform/orgs?organizationId=${organizationId}`,
    );
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(json.error || "Failed to load tenant");
      return;
    }
    setDetail(json);
    const o = json.organization as Org;
    setEdit({
      name: o.name,
      industry: o.industry || "",
      companySize: o.companySize || "",
      country: o.country || "",
      region: o.region || "",
      city: o.city || "",
      billingEmail: o.billingEmail || "",
      billingContact: o.billingContact || "",
      phone: o.phone || "",
      website: o.website || "",
      segment: o.segment || "",
      mrrCents: o.mrrCents || 0,
      healthScore: o.healthScore || 100,
      customDomain: o.customDomain || "",
      notes: o.notes || "",
      whiteLabel: o.whiteLabel,
      brandColor: o.brandColor || "",
      trialEndsAt: o.trialEndsAt ? o.trialEndsAt.slice(0, 10) : "",
      contractEndsAt: o.contractEndsAt ? o.contractEndsAt.slice(0, 10) : "",
    });
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredOrgs = useMemo(() => {
    if (!data) return [];
    return data.organizations.filter((o) => {
      if (filter.plan !== "all" && o.plan.key !== filter.plan) return false;
      if (filter.status === "active" && o.disabled) return false;
      if (filter.status === "suspended" && !o.disabled) return false;
      if (filter.industry !== "all" && (o.industry || "") !== filter.industry)
        return false;
      if (filter.segment !== "all" && (o.segment || "") !== filter.segment)
        return false;
      if (filter.country !== "all" && (o.country || "") !== filter.country)
        return false;
      if (filter.q) {
        const q = filter.q.toLowerCase();
        const hay = [
          o.name,
          o.slug,
          o.industry,
          o.country,
          o.segment,
          o.billingEmail,
          ...o.memberships.map((m) => m.user.email),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, filter]);

  const report = data?.businessReport;

  async function patchOrg(organizationId: string, body: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/platform/orgs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId, ...body }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json();
      setMsg(j.error || "Update failed");
      return;
    }
    await load();
    if (expandedId === organizationId) await loadDetail(organizationId);
  }

  async function saveBusinessProfile(organizationId: string) {
    const body: Record<string, unknown> = {
      name: edit.name,
      industry: edit.industry || null,
      companySize: edit.companySize || null,
      country: edit.country || null,
      region: edit.region || null,
      city: edit.city || null,
      billingEmail: edit.billingEmail || null,
      billingContact: edit.billingContact || null,
      phone: edit.phone || null,
      website: edit.website || null,
      segment: edit.segment || null,
      mrrCents: Number(edit.mrrCents) || 0,
      healthScore: Number(edit.healthScore) || 100,
      customDomain: edit.customDomain || null,
      notes: edit.notes || null,
      whiteLabel: Boolean(edit.whiteLabel),
      brandColor: edit.brandColor || null,
      trialEndsAt: edit.trialEndsAt
        ? new Date(String(edit.trialEndsAt)).toISOString()
        : null,
      contractEndsAt: edit.contractEndsAt
        ? new Date(String(edit.contractEndsAt)).toISOString()
        : null,
    };
    await patchOrg(organizationId, body);
    setMsg("Business profile saved");
  }

  async function createTenant(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/platform/orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...createOrg,
        customDomain: createOrg.customDomain || undefined,
        ownerEmail: createOrg.ownerEmail || undefined,
        ownerName: createOrg.ownerName || undefined,
        ownerPassword: createOrg.ownerPassword || undefined,
        billingEmail: createOrg.billingEmail || undefined,
      }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(j.error || "Create failed");
      return;
    }
    setMsg(`Created tenant ${j.organization.slug}`);
    await load();
  }

  async function deleteTenant(org: Org) {
    const confirmSlug = window.prompt(`Type slug "${org.slug}" to delete:`);
    if (!confirmSlug) return;
    setBusy(true);
    const res = await fetch("/api/platform/orgs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: org.id, confirmSlug }),
    });
    setBusy(false);
    const j = await res.json();
    if (!res.ok) {
      setMsg(j.error || "Delete failed");
      return;
    }
    setMsg(`Deleted ${org.name}`);
    if (expandedId === org.id) {
      setExpandedId(null);
      setDetail(null);
    }
    await load();
  }

  async function saveSettings(field: string, value: string) {
    setBusy(true);
    await fetch("/api/platform/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setBusy(false);
    await load();
  }

  async function createCoupon(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/platform/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(coupon),
    });
    setBusy(false);
    if (res.ok) {
      setCoupon({ code: "", percentOff: 20 });
      await load();
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/platform/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    const j = await res.json();
    setBusy(false);
    setMsg(res.ok ? `Created ${j.user.email}` : j.error || "Failed");
    if (res.ok) await load();
  }

  async function grantImpersonate(userId: string) {
    setBusy(true);
    const res = await fetch("/api/platform/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const j = await res.json();
    setBusy(false);
    setMsg(
      res.ok
        ? `Impersonation grant: login as ${j.email} / ${j.temporaryPassword}`
        : j.error || "Failed",
    );
  }

  async function toggleExpand(org: Org) {
    if (expandedId === org.id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(org.id);
    await loadDetail(org.id);
  }

  function exportCsv() {
    if (!data) return;
    const rows = [
      [
        "name",
        "slug",
        "plan",
        "status",
        "industry",
        "segment",
        "size",
        "country",
        "mrr",
        "health",
        "members",
        "tickets",
        "open",
        "billingEmail",
      ],
      ...filteredOrgs.map((o) => [
        o.name,
        o.slug,
        o.plan.key,
        o.disabled ? "suspended" : "active",
        o.industry || "",
        o.segment || "",
        o.companySize || "",
        o.country || "",
        String(o.mrrCents / 100),
        String(o.healthScore),
        String(o._count.memberships),
        String(o._count.tickets),
        String(o.openTickets ?? 0),
        o.billingEmail || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tenants-business-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!data) {
    return (
      <div className="p-8 text-sm text-slate-500">Loading platform console…</div>
    );
  }

  return (
    <div className="flex min-h-full bg-slate-100 text-slate-900">
      <aside className="flex w-[260px] shrink-0 flex-col border-r border-slate-800 bg-slate-950 text-slate-100">
        <div className="border-b border-slate-800 px-4 py-4">
          <div className="text-lg font-semibold tracking-tight text-white">
            Support Desk
          </div>
          <div className="text-[11px] uppercase tracking-wider text-sky-300/80">
            Super Admin
          </div>
        </div>
        <nav className="flex-1 space-y-3 overflow-y-auto p-3">
          {PLATFORM_NAV.map((group) => (
            <div key={group.id}>
              <button
                type="button"
                onClick={() =>
                  setNavOpen((s) => ({ ...s, [group.id]: !s[group.id] }))
                }
                className="mb-1 flex w-full items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400"
              >
                <span>
                  <span className="mr-1.5 opacity-70">{group.icon}</span>
                  {group.label}
                </span>
                <span className="text-slate-600">
                  {navOpen[group.id] === false ? "+" : "–"}
                </span>
              </button>
              {navOpen[group.id] !== false ? (
                <ul className="space-y-0.5">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setTab(item.id)}
                        className={`w-full rounded-md px-3 py-1.5 text-left text-sm transition ${
                          tab === item.id
                            ? "bg-sky-600 text-white"
                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                        }`}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </nav>
        <div className="border-t border-slate-800 p-3">
          <ul className="space-y-0.5">
            {PLATFORM_FOOTER_NAV.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`w-full rounded-md px-3 py-1.5 text-left text-sm ${
                    tab === item.id
                      ? "bg-sky-600 text-white"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 truncate px-2 text-xs text-slate-500">
            {email}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-5 backdrop-blur">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {labelForNav(tab)}
            </div>
            <div className="text-xs text-slate-500">Platform operations</div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50"
            >
              Refresh
            </button>
            <a
              href="/desk"
              className="rounded-full border border-slate-200 px-3 py-1.5 text-sky-700 hover:bg-sky-50"
            >
              Desk
            </a>
            <a
              href="/api/auth/signout"
              className="rounded-full bg-slate-900 px-3 py-1.5 text-white"
            >
              Sign out
            </a>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-[radial-gradient(ellipse_at_top,_#e0f2fe_0%,_#f8fafc_45%,_#e2e8f0_100%)] p-5">
        {msg ? (
          <p className="mb-4 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
            {msg}
          </p>
        ) : null}

        {tab === "overview" && report ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <KpiCard
                label="MRR"
                value={money(report.totals.totalMrr)}
                hint={`ARR ${money(report.totals.arr ?? report.totals.totalMrr * 12)}`}
                accent="#10b981"
                onClick={() => setTab("revenue")}
              />
              <KpiCard
                label="Active tenants"
                value={report.totals.active}
                hint={`${report.totals.suspended} suspended`}
                onClick={() => {
                  setFilter((s) => ({ ...s, status: "active" }));
                  setTab("companies");
                }}
              />
              <KpiCard
                label="Trials"
                value={report.totals.trial}
                hint="Ending within window"
                accent="#f59e0b"
                onClick={() => setTab("companies")}
              />
              <KpiCard
                label="Tickets today"
                value={report.totals.ticketsToday ?? 0}
                hint={`${report.totals.totalTickets} all-time`}
                accent="#6366f1"
              />
              <KpiCard
                label="Members"
                value={report.totals.totalMembers}
                hint="Across all orgs"
              />
              <KpiCard
                label="Avg health"
                value={report.totals.avgHealth}
                hint="Platform score"
                accent="#14b8a6"
              />
              <KpiCard
                label="Tenants"
                value={report.totals.tenants}
                hint="Total accounts"
                onClick={() => setTab("companies")}
              />
              <KpiCard
                label="Open load"
                value={data.organizations.reduce(
                  (a, o) => a + (o.openTickets ?? 0),
                  0,
                )}
                hint="Open + pending"
                accent="#f43f5e"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <AreaTrend
                  title="Ticket volume · 14 days"
                  color="#6366f1"
                  series={(report.charts?.ticketTrend || []).map((d) => ({
                    label: d.label,
                    value: d.created,
                  }))}
                />
              </div>
              <HealthGauge score={report.totals.avgHealth} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <AreaTrend
                title="Platform MRR trend"
                color="#10b981"
                series={report.charts?.mrrTrend || []}
                formatValue={money}
              />
              <AreaTrend
                title="Tenant growth"
                color="#0ea5e9"
                series={report.charts?.tenantGrowth || []}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <InteractiveDonut
                title="Tenants by plan"
                segments={(report.groups.byPlan || []).map((g, i) => ({
                  label: g.label,
                  value: g.count,
                  color: colorAt(i),
                }))}
                onSelect={(label) => {
                  setFilter((s) => ({ ...s, plan: label }));
                  setTab("companies");
                }}
              />
              <InteractiveDonut
                title="By industry"
                segments={(report.groups.byIndustry || []).map((g, i) => ({
                  label: g.label,
                  value: g.count,
                  color: colorAt(i + 2),
                }))}
                onSelect={(label) => {
                  setFilter((s) => ({
                    ...s,
                    industry: label === "unspecified" ? "all" : label,
                  }));
                  setTab("companies");
                }}
              />
              <InteractiveBars
                title="Health distribution"
                valueLabel="tenants"
                data={(report.charts?.healthBuckets || []).map((b, i) => ({
                  label: b.label,
                  value: b.value,
                  color: colorAt(i),
                }))}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <HorizontalRank
                title="Top tenants by MRR"
                formatValue={money}
                rows={(report.charts?.topByMrr || []).map((t) => ({
                  id: t.id,
                  label: t.name,
                  value: t.value,
                  meta: `${t.plan} · health ${t.health}`,
                }))}
                onSelect={(id) => {
                  setTab("companies");
                  setExpandedId(id);
                  void loadDetail(id);
                }}
              />
              <HorizontalRank
                title="Top by ticket volume"
                rows={(report.charts?.topByTickets || []).map((t) => ({
                  id: t.id,
                  label: t.name,
                  value: t.value,
                  meta: t.plan,
                }))}
                onSelect={(id) => {
                  setTab("companies");
                  setExpandedId(id);
                  void loadDetail(id);
                }}
              />
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-800">
                  At-risk accounts
                </h3>
                <ul className="mt-3 space-y-2">
                  {(report.charts?.atRisk || []).length === 0 ? (
                    <li className="text-sm text-slate-400">
                      No at-risk tenants 🎉
                    </li>
                  ) : (
                    (report.charts?.atRisk || []).map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setTab("companies");
                            setExpandedId(t.id);
                            void loadDetail(t.id);
                          }}
                          className="flex w-full items-start justify-between gap-2 rounded-xl border border-rose-100 bg-rose-50/60 px-3 py-2 text-left hover:bg-rose-50"
                        >
                          <div>
                            <div className="text-sm font-medium text-slate-900">
                              {t.name}
                            </div>
                            <div className="text-xs text-rose-700">
                              {t.reason}
                            </div>
                          </div>
                          <div className="text-right text-xs text-slate-500">
                            <div>{money(t.mrr)}</div>
                            <div>health {t.health}</div>
                          </div>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
                <button
                  type="button"
                  onClick={() => setTab("companies")}
                  className="mt-4 text-sm font-medium text-sky-700 hover:underline"
                >
                  Manage all tenants →
                </button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <InteractiveBars
                title="Segment mix"
                data={(report.groups.bySegment || []).map((g, i) => ({
                  label: g.label,
                  value: g.count,
                  color: colorAt(i),
                }))}
                onSelect={(label) => {
                  setFilter((s) => ({
                    ...s,
                    segment: label === "unspecified" ? "all" : label,
                  }));
                  setTab("companies");
                }}
              />
              <InteractiveBars
                title="Geography"
                data={(report.groups.byCountry || []).map((g, i) => ({
                  label: g.label,
                  value: g.count,
                  color: colorAt(i + 3),
                }))}
                onSelect={(label) => {
                  setFilter((s) => ({
                    ...s,
                    country: label === "unspecified" ? "all" : label,
                  }));
                  setTab("companies");
                }}
              />
            </div>
          </div>
        ) : null}

        {tab === "companies" ? (
          <div className="space-y-6">
            <form
              onSubmit={createTenant}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <h2 className="font-semibold text-slate-900">Create tenant</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ["name", "Company name", "text"],
                    ["ownerEmail", "Owner email", "email"],
                    ["ownerName", "Owner name", "text"],
                    ["billingEmail", "Billing email", "email"],
                    ["customDomain", "Custom domain", "text"],
                    ["country", "Country", "text"],
                  ] as const
                ).map(([key, ph]) => (
                  <input
                    key={key}
                    required={key === "name"}
                    placeholder={ph}
                    value={String(createOrg[key] ?? "")}
                    onChange={(e) =>
                      setCreateOrg((s) => ({ ...s, [key]: e.target.value }))
                    }
                    className="rounded border border-slate-200 px-3 py-2 text-sm"
                  />
                ))}
                <select
                  value={createOrg.planKey}
                  onChange={(e) =>
                    setCreateOrg((s) => ({ ...s, planKey: e.target.value }))
                  }
                  className="rounded border border-slate-200 px-3 py-2 text-sm"
                >
                  {data.plans.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select
                  value={createOrg.industry}
                  onChange={(e) =>
                    setCreateOrg((s) => ({ ...s, industry: e.target.value }))
                  }
                  className="rounded border border-slate-200 px-3 py-2 text-sm"
                >
                  {INDUSTRIES.map((i) => (
                    <option key={i}>{i}</option>
                  ))}
                </select>
                <select
                  value={createOrg.segment}
                  onChange={(e) =>
                    setCreateOrg((s) => ({ ...s, segment: e.target.value }))
                  }
                  className="rounded border border-slate-200 px-3 py-2 text-sm"
                >
                  {SEGMENTS.map((i) => (
                    <option key={i}>{i}</option>
                  ))}
                </select>
                <select
                  value={createOrg.companySize}
                  onChange={(e) =>
                    setCreateOrg((s) => ({ ...s, companySize: e.target.value }))
                  }
                  className="rounded border border-slate-200 px-3 py-2 text-sm"
                >
                  {SIZES.map((i) => (
                    <option key={i}>{i}</option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="MRR cents"
                  value={createOrg.mrrCents}
                  onChange={(e) =>
                    setCreateOrg((s) => ({
                      ...s,
                      mrrCents: Number(e.target.value),
                    }))
                  }
                  className="rounded border border-slate-200 px-3 py-2 text-sm"
                />
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={createOrg.whiteLabel}
                    onChange={(e) =>
                      setCreateOrg((s) => ({
                        ...s,
                        whiteLabel: e.target.checked,
                      }))
                    }
                  />
                  White label
                </label>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="mt-3 rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                Create tenant
              </button>
            </form>

            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3">
              <input
                placeholder="Search tenants…"
                value={filter.q}
                onChange={(e) =>
                  setFilter((s) => ({ ...s, q: e.target.value }))
                }
                className="min-w-[180px] flex-1 rounded border border-slate-200 px-3 py-1.5 text-sm"
              />
              {(
                [
                  ["plan", ["all", "free", "pro", "enterprise"]],
                  ["status", ["all", "active", "suspended"]],
                  ["industry", ["all", ...INDUSTRIES]],
                  ["segment", ["all", ...SEGMENTS]],
                ] as const
              ).map(([key, opts]) => (
                <select
                  key={key}
                  value={filter[key]}
                  onChange={(e) =>
                    setFilter((s) => ({ ...s, [key]: e.target.value }))
                  }
                  className="rounded border border-slate-200 px-2 py-1.5 text-sm"
                >
                  {opts.map((o) => (
                    <option key={o} value={o}>
                      {key}: {o}
                    </option>
                  ))}
                </select>
              ))}
              <button
                type="button"
                onClick={exportCsv}
                className="rounded border border-slate-200 px-3 py-1.5 text-sm"
              >
                Export CSV
              </button>
            </div>

            <ul className="space-y-3">
              {filteredOrgs.map((o) => (
                <li
                  key={o.id}
                  className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => toggleExpand(o)}
                    >
                      <div className="font-medium text-slate-900">
                        {o.name}{" "}
                        <span
                          className={`text-xs ${o.disabled ? "text-rose-600" : "text-emerald-600"}`}
                        >
                          {o.disabled ? "suspended" : "active"}
                        </span>
                        {o.whiteLabel ? (
                          <span className="ml-2 text-xs text-violet-600">
                            white-label
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {o.slug} · {o.plan.name} · {o.industry || "—"} ·{" "}
                        {o.segment || "—"} · {o.country || "—"} · health{" "}
                        {o.healthScore} · MRR {money(o.mrrCents / 100)}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {o._count.memberships} members · {o._count.tickets}{" "}
                        tickets · {o.openTickets ?? 0} open ·{" "}
                        {o._count.contacts ?? 0} contacts ·{" "}
                        {o._count.companies ?? 0} companies · admins:{" "}
                        {o.memberships.map((m) => m.user.email).join(", ") ||
                          "—"}
                      </div>
                    </button>
                    <div className="flex flex-wrap gap-2">
                      <select
                        disabled={busy}
                        defaultValue={o.plan.key}
                        onChange={(e) =>
                          patchOrg(o.id, { planKey: e.target.value })
                        }
                        className="rounded border border-slate-200 px-2 py-1 text-sm"
                      >
                        {data.plans.map((p) => (
                          <option key={p.key} value={p.key}>
                            {p.key}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          patchOrg(o.id, { disabled: !o.disabled })
                        }
                        className="rounded border border-slate-200 px-2 py-1 text-sm"
                      >
                        {o.disabled ? "Activate" : "Suspend"}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleExpand(o)}
                        className="rounded bg-slate-900 px-2 py-1 text-sm text-white"
                      >
                        {expandedId === o.id ? "Hide details" : "Full details"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => deleteTenant(o)}
                        className="rounded border border-rose-200 px-2 py-1 text-sm text-rose-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {expandedId === o.id && detail?.organization.id === o.id ? (
                    <div className="border-t border-slate-100 bg-slate-50/60 p-4">
                      <div className="mb-4 grid gap-2 sm:grid-cols-4 lg:grid-cols-8">
                        <Stat label="Open" value={detail.usage.openTickets} />
                        <Stat
                          label="Pending"
                          value={detail.usage.pendingTickets}
                        />
                        <Stat
                          label="Created / wk"
                          value={detail.usage.createdWeek}
                        />
                        <Stat
                          label="Closed / wk"
                          value={detail.usage.closedWeek}
                        />
                        <Stat
                          label="Seats"
                          value={`${detail.usage.seats}/${detail.usage.seatLimit}`}
                        />
                        <Stat
                          label="CSAT"
                          value={detail.usage.csatAvg ?? "—"}
                        />
                        <Stat
                          label="SLA breach"
                          value={detail.usage.slaBreached}
                        />
                        <Stat
                          label="Health"
                          value={detail.usage.healthScore}
                        />
                      </div>

                      <div className="mb-4 grid gap-3 lg:grid-cols-5">
                        <Bars
                          title="By status"
                          rows={detail.breakdowns.byStatus}
                        />
                        <Bars
                          title="By priority"
                          rows={detail.breakdowns.byPriority}
                        />
                        <Bars
                          title="By channel"
                          rows={detail.breakdowns.byChannel}
                        />
                        <Bars
                          title="By department"
                          rows={detail.breakdowns.byDepartment}
                        />
                        <Bars title="By role" rows={detail.breakdowns.byRole} />
                      </div>

                      <div className="mb-4 grid gap-4 lg:grid-cols-2">
                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                          <h3 className="text-sm font-semibold">
                            Business profile
                          </h3>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {(
                              [
                                ["name", "Name"],
                                ["industry", "Industry"],
                                ["companySize", "Company size"],
                                ["segment", "Segment"],
                                ["country", "Country"],
                                ["region", "Region"],
                                ["city", "City"],
                                ["billingEmail", "Billing email"],
                                ["billingContact", "Billing contact"],
                                ["phone", "Phone"],
                                ["website", "Website"],
                                ["customDomain", "Custom domain"],
                                ["brandColor", "Brand color"],
                                ["mrrCents", "MRR (cents)"],
                                ["healthScore", "Health score"],
                                ["trialEndsAt", "Trial ends"],
                                ["contractEndsAt", "Contract ends"],
                              ] as const
                            ).map(([key, label]) => (
                              <label key={key} className="text-xs text-slate-500">
                                {label}
                                <input
                                  value={String(edit[key] ?? "")}
                                  onChange={(e) =>
                                    setEdit((s) => ({
                                      ...s,
                                      [key]: e.target.value,
                                    }))
                                  }
                                  className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-900"
                                />
                              </label>
                            ))}
                            <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                              <input
                                type="checkbox"
                                checked={Boolean(edit.whiteLabel)}
                                onChange={(e) =>
                                  setEdit((s) => ({
                                    ...s,
                                    whiteLabel: e.target.checked,
                                  }))
                                }
                              />
                              White label
                            </label>
                            <label className="text-xs text-slate-500 sm:col-span-2">
                              Internal notes
                              <textarea
                                rows={3}
                                value={String(edit.notes ?? "")}
                                onChange={(e) =>
                                  setEdit((s) => ({
                                    ...s,
                                    notes: e.target.value,
                                  }))
                                }
                                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-900"
                              />
                            </label>
                          </div>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => saveBusinessProfile(o.id)}
                            className="mt-3 rounded bg-sky-700 px-3 py-1.5 text-sm text-white"
                          >
                            Save business profile
                          </button>
                        </div>

                        <div className="space-y-3">
                          <div className="rounded-lg border border-slate-200 bg-white p-3">
                            <h3 className="text-sm font-semibold">
                              Product usage
                            </h3>
                            <ul className="mt-2 grid grid-cols-2 gap-1 text-xs text-slate-600">
                              <li>
                                Contacts:{" "}
                                {detail.organization._count.contacts ?? 0}
                              </li>
                              <li>Companies: {detail.usage.companies}</li>
                              <li>
                                KB articles: {detail.usage.publishedArticles}
                              </li>
                              <li>
                                Automations: {detail.usage.activeAutomations}
                              </li>
                              <li>
                                SLA policies:{" "}
                                {detail.organization._count.slaPolicies ?? 0}
                              </li>
                              <li>
                                Macros: {detail.organization._count.macros ?? 0}
                              </li>
                              <li>
                                Canned:{" "}
                                {detail.organization._count.cannedResponses ?? 0}
                              </li>
                              <li>Storage: {detail.usage.storageMb} MB</li>
                              <li>
                                Seat util: {detail.usage.seatUtilization}%
                              </li>
                              <li>
                                Customers: {detail.usage.customers}
                              </li>
                            </ul>
                          </div>

                          <div className="rounded-lg border border-slate-200 bg-white p-3">
                            <h3 className="text-sm font-semibold">Team</h3>
                            <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs">
                              {detail.organization.memberships.map((m) => (
                                <li key={m.id} className="flex justify-between">
                                  <span>
                                    {m.user.name} · {m.user.email}
                                  </span>
                                  <span className="text-slate-500">
                                    {ROLE_LABELS[m.role] || m.role}
                                    {m.disabled ? " (disabled)" : ""}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="rounded-lg border border-slate-200 bg-white p-3">
                            <h3 className="text-sm font-semibold">
                              Recent tickets
                            </h3>
                            <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs">
                              {detail.recentTickets.map((t) => (
                                <li key={t.id}>
                                  <span className="font-medium">{t.subject}</span>{" "}
                                  <span className="text-slate-500">
                                    {t.status}/{t.priority} · {t.channel || "—"}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : expandedId === o.id ? (
                    <div className="border-t border-slate-100 px-4 py-6 text-sm text-slate-500">
                      Loading tenant intelligence…
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {tab === "reports" && report ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Grouped business reports
                </h2>
                <p className="text-sm text-slate-500">
                  Click any chart slice or bar to jump into filtered tenants.
                </p>
              </div>
              <div className="flex gap-2">
                <select
                  value={groupBy}
                  onChange={(e) =>
                    setGroupBy(e.target.value as typeof groupBy)
                  }
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm"
                >
                  <option value="byPlan">By plan</option>
                  <option value="byIndustry">By industry</option>
                  <option value="byCountry">By country</option>
                  <option value="bySegment">By segment</option>
                  <option value="byCompanySize">By company size</option>
                  <option value="byStatus">By status</option>
                </select>
                <button
                  type="button"
                  onClick={exportCsv}
                  className="rounded-full bg-slate-900 px-3 py-1.5 text-sm text-white"
                >
                  Export filtered CSV
                </button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <InteractiveDonut
                title="Current group · share"
                segments={(report.groups[groupBy] || []).map((g, i) => ({
                  label: g.label,
                  value: g.count,
                  color: colorAt(i),
                }))}
                onSelect={(label) => {
                  if (groupBy === "byPlan")
                    setFilter((s) => ({ ...s, plan: label }));
                  if (groupBy === "byIndustry")
                    setFilter((s) => ({
                      ...s,
                      industry: label === "unspecified" ? "all" : label,
                    }));
                  if (groupBy === "bySegment")
                    setFilter((s) => ({
                      ...s,
                      segment: label === "unspecified" ? "all" : label,
                    }));
                  if (groupBy === "byStatus")
                    setFilter((s) => ({
                      ...s,
                      status: label === "active" ? "active" : "suspended",
                    }));
                  setTab("companies");
                }}
              />
              <InteractiveBars
                title="Tickets by group"
                data={(report.groups[groupBy] || []).map((g, i) => ({
                  label: g.label,
                  value: g.tickets,
                  color: colorAt(i),
                }))}
              />
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Group</th>
                    <th className="px-4 py-3">Tenants</th>
                    <th className="px-4 py-3">Tickets</th>
                    <th className="px-4 py-3">MRR</th>
                    <th className="px-4 py-3">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.groups[groupBy] || []).map((row) => {
                    const share =
                      report.totals.tenants === 0
                        ? 0
                        : Math.round(
                            (row.count / report.totals.tenants) * 100,
                          );
                    return (
                      <tr
                        key={row.label}
                        className="border-t border-slate-100 hover:bg-sky-50/40"
                      >
                        <td className="px-4 py-2.5 font-medium">{row.label}</td>
                        <td className="px-4 py-2.5">{row.count}</td>
                        <td className="px-4 py-2.5">{row.tickets}</td>
                        <td className="px-4 py-2.5">{money(row.mrr)}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded bg-slate-100">
                              <div
                                className="h-full bg-emerald-500"
                                style={{ width: `${share}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500">
                              {share}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <AreaTrend
                title="MRR"
                color="#10b981"
                series={report.charts?.mrrTrend || []}
                formatValue={money}
              />
              <AreaTrend
                title="Tickets"
                color="#6366f1"
                series={(report.charts?.ticketTrend || []).map((d) => ({
                  label: d.label,
                  value: d.created,
                }))}
              />
              <AreaTrend
                title="Tenants"
                color="#0ea5e9"
                series={report.charts?.tenantGrowth || []}
              />
            </div>
          </div>
        ) : null}


        {tab === "users" ? (
          <div className="space-y-6">
            <form
              onSubmit={createUser}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <h2 className="font-semibold">Create user</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <input
                  required
                  placeholder="Email"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser((s) => ({ ...s, email: e.target.value }))
                  }
                  className="rounded border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  required
                  placeholder="Name"
                  value={newUser.name}
                  onChange={(e) =>
                    setNewUser((s) => ({ ...s, name: e.target.value }))
                  }
                  className="rounded border border-slate-200 px-3 py-2 text-sm"
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newUser.isSuperAdmin}
                    onChange={(e) =>
                      setNewUser((s) => ({
                        ...s,
                        isSuperAdmin: e.target.checked,
                      }))
                    }
                  />
                  Super admin
                </label>
              </div>
              <button
                type="submit"
                className="mt-3 rounded bg-slate-900 px-4 py-2 text-sm text-white"
              >
                Create
              </button>
            </form>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
              {data.users.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div>
                    <div className="font-medium">
                      {u.name}{" "}
                      {u.isSuperAdmin ? (
                        <span className="text-xs text-amber-600">super</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => grantImpersonate(u.id)}
                    className="rounded border border-slate-200 px-2 py-1 text-xs"
                  >
                    Impersonate
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}



        {tab === "roles" ? (
          <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2">Permission</th>
                  {(Object.keys(ROLE_PERMISSIONS) as MembershipRole[]).map(
                    (role) => (
                      <th key={role} className="px-2 py-2 font-medium">
                        {ROLE_LABELS[role]}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((perm) => (
                  <tr key={perm} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 font-mono text-[11px] text-slate-700">
                      {perm}
                    </td>
                    {(Object.keys(ROLE_PERMISSIONS) as MembershipRole[]).map(
                      (role) => (
                        <td key={role} className="px-2 py-1.5 text-center">
                          {ROLE_PERMISSIONS[role].includes(perm) ? "✓" : ""}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
              Super Admin bypasses all checks. Plan feature gates are under Platform → Features.
            </p>
          </div>
        ) : null}

        {![
          "overview",
          "companies",
          "users",
          "roles",
          "reports",
        ].includes(tab) ? (
          <PlatformSectionPanel
            section={tab}
            email={email}
            name={name}
            organizations={data.organizations}
            plans={data.plans}
            coupons={data.coupons}
            settings={data.settings}
            auditLogs={data.auditLogs}
            onOpenCompany={(id) => {
              setTab("companies");
              setExpandedId(id);
              void loadDetail(id);
            }}
            onRefresh={() => void load()}
            onCreateCoupon={async (code, percentOff) => {
              await fetch("/api/platform/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code, percentOff }),
              });
              await load();
            }}
            onSaveSetting={async (field, value) => {
              await saveSettings(field, value);
            }}
          />
        ) : null}
        </main>
      </div>
    </div>
  );
}
