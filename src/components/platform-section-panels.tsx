"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AreaTrend,
  HorizontalRank,
  InteractiveBars,
  InteractiveDonut,
  KpiCard,
  colorAt,
} from "@/components/platform-charts";
import { PlatformDashboardsPanel } from "@/components/platform-dashboards-panel";
import { PlansEditor } from "@/components/plans-editor";
import type { PlatformNavId } from "@/lib/platform-nav";

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

type OrgLite = {
  id: string;
  name: string;
  slug: string;
  customDomain: string | null;
  storageUsedBytes: number;
  mrrCents: number;
  healthScore: number;
  disabled: boolean;
  plan: { key: string; name: string };
  _count: { tickets: number; memberships: number };
  openTickets?: number;
};

export function PlatformSectionPanel({
  section,
  email,
  name,
  organizations,
  plans,
  coupons,
  settings,
  auditLogs,
  onOpenCompany,
  onRefresh,
  onCreateCoupon,
  onSaveSetting,
}: {
  section: PlatformNavId;
  email: string;
  name?: string;
  organizations: OrgLite[];
  plans: { key: string; name: string; seatLimit: number; description: string | null }[];
  coupons: { id: string; code: string; percentOff: number; active: boolean }[];
  settings: Record<string, string>;
  auditLogs: {
    id: string;
    action: string;
    createdAt: string;
    actor?: { email: string; name: string } | null;
    organization?: { name: string; slug: string } | null;
  }[];
  onOpenCompany: (id: string) => void;
  onRefresh: () => void;
  onCreateCoupon: (code: string, percentOff: number) => Promise<void>;
  onSaveSetting: (field: string, value: string) => Promise<void>;
}) {
  if (
    section === "analytics" ||
    section === "revenue" ||
    section === "billing" ||
    section === "health" ||
    section === "features"
  ) {
    return (
      <PlatformDashboardsPanel
        panel={
          section === "analytics"
            ? "analytics"
            : section === "revenue"
              ? "revenue"
              : section === "billing"
                ? "billing"
                : section === "health"
                  ? "health"
                  : "features"
        }
        onOpenTenant={onOpenCompany}
      />
    );
  }

  if (section === "invoices") {
    return <InvoicesPanel onOpenCompany={onOpenCompany} />;
  }

  if (section === "ai-insights" || section === "ai-usage") {
    return <AiUsagePanel onOpenCompany={onOpenCompany} />;
  }

  if (section === "ai-prompts") return <AiPromptsPanel />;
  if (section === "ai-models") return <AiModelsPanel />;
  if (section === "ai-costs") return <AiCostsPanel />;

  if (section === "domains") {
    return (
      <div className="space-y-4">
        <SectionHeader
          title="Domains"
          subtitle="Custom domains and white-label hosts"
          onRefresh={onRefresh}
        />
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Company</th>
                <th className="px-4 py-2">Domain</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((o) => (
                <tr key={o.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      className="font-medium text-sky-700 hover:underline"
                      onClick={() => onOpenCompany(o.id)}
                    >
                      {o.name}
                    </button>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {o.customDomain || "—"}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {o.customDomain ? (
                      <span className="text-emerald-600">configured</span>
                    ) : (
                      <span className="text-slate-400">not set</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (section === "storage") {
    const total = organizations.reduce((a, o) => a + o.storageUsedBytes, 0);
    return (
      <div className="space-y-4">
        <SectionHeader title="Storage" subtitle="Tenant disk usage" onRefresh={onRefresh} />
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard
            label="Total used"
            value={`${(total / 1024 / 1024).toFixed(1)} MB`}
          />
          <KpiCard label="Tenants" value={organizations.length} />
          <KpiCard
            label="Avg / tenant"
            value={`${organizations.length ? (total / organizations.length / 1024 / 1024).toFixed(1) : 0} MB`}
          />
        </div>
        <HorizontalRank
          title="Storage by company"
          formatValue={(n) => `${n.toFixed(1)} MB`}
          rows={[...organizations]
            .sort((a, b) => b.storageUsedBytes - a.storageUsedBytes)
            .map((o) => ({
              id: o.id,
              label: o.name,
              value: o.storageUsedBytes / 1024 / 1024,
              meta: o.plan.name,
            }))}
          onSelect={(id) => onOpenCompany(id)}
        />
      </div>
    );
  }

  if (section === "usage" || section === "usage-report") {
    return (
      <div className="space-y-4">
        <SectionHeader
          title="Usage"
          subtitle="Seats, tickets and open load by tenant"
          onRefresh={onRefresh}
        />
        <div className="grid gap-3 sm:grid-cols-4">
          <KpiCard
            label="Members"
            value={organizations.reduce((a, o) => a + o._count.memberships, 0)}
          />
          <KpiCard
            label="Tickets"
            value={organizations.reduce((a, o) => a + o._count.tickets, 0)}
          />
          <KpiCard
            label="Open load"
            value={organizations.reduce((a, o) => a + (o.openTickets ?? 0), 0)}
          />
          <KpiCard
            label="MRR"
            value={money(
              organizations.reduce((a, o) => a + o.mrrCents, 0) / 100,
            )}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <HorizontalRank
            title="Tickets by company"
            rows={[...organizations]
              .sort((a, b) => b._count.tickets - a._count.tickets)
              .map((o) => ({
                id: o.id,
                label: o.name,
                value: o._count.tickets,
                meta: `${o.openTickets ?? 0} open`,
              }))}
            onSelect={(id) => onOpenCompany(id)}
          />
          <HorizontalRank
            title="Seats by company"
            rows={[...organizations]
              .sort((a, b) => b._count.memberships - a._count.memberships)
              .map((o) => ({
                id: o.id,
                label: o.name,
                value: o._count.memberships,
                meta: o.plan.name,
              }))}
            onSelect={(id) => onOpenCompany(id)}
          />
        </div>
      </div>
    );
  }

  if (section === "plans") {
    return <PlansEditor onChanged={onRefresh} />;
  }

  if (section === "coupons") {
    return (
      <CouponsPanel coupons={coupons} onCreate={onCreateCoupon} onRefresh={onRefresh} />
    );
  }

  if (section === "growth") {
    const active = organizations.filter((o) => !o.disabled).length;
    const series = Array.from({ length: 8 }, (_, i) => ({
      label: `W${i + 1}`,
      value: Math.max(1, Math.round(active * ((i + 1) / 8))),
    }));
    return (
      <div className="space-y-4">
        <SectionHeader title="Growth" subtitle="Tenant and revenue trajectory" onRefresh={onRefresh} />
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard label="Active companies" value={active} />
          <KpiCard
            label="New (listed)"
            value={organizations.length}
            hint="Seeded + created"
          />
          <KpiCard
            label="Paying"
            value={organizations.filter((o) => o.mrrCents > 0).length}
          />
        </div>
        <AreaTrend title="Tenant growth (projected)" color="#0ea5e9" series={series} />
      </div>
    );
  }

  if (section === "churn") {
    const suspended = organizations.filter((o) => o.disabled);
    const atRisk = organizations.filter((o) => o.healthScore < 60 && !o.disabled);
    return (
      <div className="space-y-4">
        <SectionHeader title="Churn" subtitle="Suspended and at-risk accounts" onRefresh={onRefresh} />
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard label="Suspended" value={suspended.length} accent="#f43f5e" />
          <KpiCard label="At risk" value={atRisk.length} accent="#f59e0b" />
          <KpiCard
            label="Churn rate"
            value={`${organizations.length ? Math.round((suspended.length / organizations.length) * 1000) / 10 : 0}%`}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <HorizontalRank
            title="Suspended"
            rows={suspended.map((o) => ({
              id: o.id,
              label: o.name,
              value: o.mrrCents / 100,
              meta: o.plan.key,
            }))}
            formatValue={money}
            onSelect={(id) => onOpenCompany(id)}
          />
          <HorizontalRank
            title="Low health"
            rows={atRisk.map((o) => ({
              id: o.id,
              label: o.name,
              value: o.healthScore,
              meta: money(o.mrrCents / 100),
            }))}
            onSelect={(id) => onOpenCompany(id)}
          />
        </div>
      </div>
    );
  }

  if (section === "email" || section === "sms" || section === "whatsapp") {
    const field =
      section === "email"
        ? "emailJson"
        : section === "sms"
          ? "smsJson"
          : "whatsappJson";
    return (
      <JsonConfigPanel
        title={section === "email" ? "Email" : section === "sms" ? "SMS" : "WhatsApp"}
        field={field}
        value={settings[field] || "{}"}
        onSave={onSaveSetting}
      />
    );
  }

  if (section === "api") {
    return (
      <div className="space-y-4">
        <SectionHeader title="API" subtitle="Platform API access & keys" onRefresh={onRefresh} />
        <div className="grid gap-4 lg:grid-cols-2">
          <KpiCard label="REST base" value="/api/*" hint="Tenant-scoped with JWT" />
          <KpiCard label="Platform API" value="/api/platform/*" hint="Super-admin only" />
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h3 className="text-sm font-semibold">Integration endpoints</h3>
            <ul className="mt-3 space-y-2 font-mono text-xs text-slate-600">
              <li>GET /api/platform/orgs</li>
              <li>GET /api/platform/dashboards?panel=revenue|health|billing|analytics|features</li>
              <li>POST /api/platform/users</li>
              <li>POST /api/platform/impersonate</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (section === "integrations") {
    return (
      <div className="space-y-4">
        <SectionHeader
          title="Integrations"
          subtitle="Connected systems across tenants"
          onRefresh={onRefresh}
        />
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["Freshdesk", "Per-tenant sync"],
            ["Stripe", "Billing & checkout"],
            ["AI Suggest", "Reply assistance"],
            ["Webhooks", "Outbound events"],
            ["Email", "SMTP / provider"],
            ["WhatsApp", "Messaging channel"],
          ].map(([name, desc], i) => (
            <div
              key={name}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div
                className="mb-2 h-2 w-10 rounded-full"
                style={{ background: colorAt(i) }}
              />
              <div className="font-semibold text-slate-900">{name}</div>
              <div className="text-sm text-slate-500">{desc}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section === "audit") {
    return (
      <div className="space-y-4">
        <SectionHeader title="Audit Logs" subtitle="Platform and tenant actions" onRefresh={onRefresh} />
        <ul className="max-h-[32rem] space-y-2 overflow-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {auditLogs.map((l) => (
            <li key={l.id} className="border-b border-slate-50 pb-2 text-sm">
              <span className="font-medium">{l.action}</span>{" "}
              <span className="text-slate-500">
                {l.actor?.email || "system"} · {l.organization?.slug || "platform"} ·{" "}
                {new Date(l.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
          {!auditLogs.length ? (
            <li className="text-slate-400">No audit events yet</li>
          ) : null}
        </ul>
      </div>
    );
  }

  if (section === "sessions") {
    return (
      <div className="space-y-4">
        <SectionHeader title="Sessions" subtitle="Active admin and staff sessions" onRefresh={onRefresh} />
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard label="Your session" value="Active" hint={email} accent="#10b981" />
            <KpiCard label="Strategy" value="JWT" hint="Auth.js credentials" />
            <KpiCard label="Max age" value="30d" hint="Session cookie" />
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Session revoke for other users is available via password reset / impersonation grant rotation.
          </p>
        </div>
      </div>
    );
  }

  if (section === "ip") {
    return (
      <IpManagementPanel
        value={settings.securityJson || "{}"}
        onSave={onSaveSetting}
      />
    );
  }

  if (section === "backups" || section === "restore") {
    return (
      <BackupPanel mode={section} onRefresh={onRefresh} />
    );
  }

  if (section === "notifications") {
    return (
      <div className="space-y-4">
        <SectionHeader title="Notifications" subtitle="Platform alert channels" onRefresh={onRefresh} />
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ["Tenant suspended", "Email + audit"],
            ["Payment failed", "Billing ops"],
            ["Health degraded", "On-call"],
            ["Trial ending", "Account managers"],
          ].map(([title, channel], i) => (
            <div
              key={title}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <div>
                <div className="font-medium">{title}</div>
                <div className="text-xs text-slate-500">{channel}</div>
              </div>
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: colorAt(i) }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section === "support") {
    return (
      <div className="space-y-4">
        <SectionHeader title="Support Center" subtitle="Internal runbooks for platform ops" />
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ["Impersonate a user", "Users → Impersonate → login with temp password"],
            ["Force a plan", "Companies → plan dropdown"],
            ["Suspend a tenant", "Companies → Suspend"],
            ["Export billing", "Billing → Download CSV / tax report"],
            ["Toggle features", "Platform → Features"],
            ["Check health", "Platform → Health (auto-refresh)"],
          ].map(([q, a]) => (
            <div key={q} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="font-medium text-slate-900">{q}</div>
              <div className="mt-1 text-sm text-slate-500">{a}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section === "profile") {
    return (
      <div className="space-y-4">
        <SectionHeader title="Profile" subtitle="Super admin identity" />
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-lg font-semibold text-white">
              {(name || email).slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div className="text-lg font-semibold">{name || "Super Admin"}</div>
              <div className="text-sm text-slate-500">{email}</div>
              <div className="mt-1 text-xs font-medium text-amber-600">
                Platform super-admin
              </div>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <KpiCard label="Access" value="Full platform" />
            <KpiCard label="Console" value="/platform" />
            <a
              href="/api/auth/signout"
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Sign out →
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (section === "permissions") {
    return (
      <div className="space-y-4">
        <SectionHeader
          title="Permissions"
          subtitle="Granular capability catalog"
          onRefresh={onRefresh}
        />
        <p className="text-sm text-slate-500">
          Open Roles for the full role × permission matrix. Feature gates by plan are under Platform → Features.
        </p>
        <PlatformDashboardsPanel panel="features" />
      </div>
    );
  }

  return null;
}

function SectionHeader({
  title,
  subtitle,
  onRefresh,
}: {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          {title}
        </h2>
        {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600"
        >
          Refresh
        </button>
      ) : null}
    </div>
  );
}

function JsonConfigPanel({
  title,
  field,
  value,
  onSave,
}: {
  title: string;
  field: string;
  value: string;
  onSave: (field: string, value: string) => Promise<void>;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div className="space-y-4">
      <SectionHeader title={title} subtitle="Provider configuration (JSON)" />
      <textarea
        rows={16}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white p-4 font-mono text-xs shadow-sm"
      />
      <button
        type="button"
        onClick={() => onSave(field, text)}
        className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white"
      >
        Save {title}
      </button>
    </div>
  );
}

function CouponsPanel({
  coupons,
  onCreate,
  onRefresh,
}: {
  coupons: { id: string; code: string; percentOff: number; active: boolean }[];
  onCreate: (code: string, percentOff: number) => Promise<void>;
  onRefresh: () => void;
}) {
  const [code, setCode] = useState("");
  const [percentOff, setPercentOff] = useState(20);
  return (
    <div className="space-y-4">
      <SectionHeader title="Coupons" subtitle="Discount codes" onRefresh={onRefresh} />
      <form
        className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={async (e) => {
          e.preventDefault();
          await onCreate(code, percentOff);
          setCode("");
        }}
      >
        <input
          required
          placeholder="CODE"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="rounded border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          type="number"
          min={1}
          max={100}
          value={percentOff}
          onChange={(e) => setPercentOff(Number(e.target.value))}
          className="w-24 rounded border border-slate-200 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white">
          Add coupon
        </button>
      </form>
      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
        {coupons.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <span className="font-medium">
              {c.code} — {c.percentOff}%{" "}
              <span className="text-xs text-slate-400">
                {c.active ? "active" : "inactive"}
              </span>
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-full border border-slate-200 px-2 py-1 text-xs"
                onClick={async () => {
                  await fetch("/api/platform/settings", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: c.id, active: !c.active }),
                  });
                  onRefresh();
                }}
              >
                {c.active ? "Disable" : "Enable"}
              </button>
              <button
                type="button"
                className="rounded-full border border-rose-200 px-2 py-1 text-xs text-rose-700"
                onClick={async () => {
                  if (!window.confirm(`Delete ${c.code}?`)) return;
                  await fetch("/api/platform/settings", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: c.id }),
                  });
                  onRefresh();
                }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InvoicesPanel({ onOpenCompany }: { onOpenCompany: (id: string) => void }) {
  const [events, setEvents] = useState<
    {
      id: string;
      type: string;
      amount: number;
      invoiceNumber: string | null;
      occurredAt: string;
      organization: { id: string; name: string } | null;
    }[]
  >([]);
  useEffect(() => {
    void fetch("/api/platform/dashboards?panel=billing")
      .then((r) => r.json())
      .then((j) => setEvents(j.events || []));
  }, []);
  const invoices = events.filter((e) => e.invoiceNumber);
  return (
    <div className="space-y-4">
      <SectionHeader title="Invoices" subtitle="Invoice numbers from billing ledger" />
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Invoice</th>
              <th className="px-4 py-2">Company</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((e) => (
              <tr key={e.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-mono text-xs">{e.invoiceNumber}</td>
                <td className="px-4 py-2">
                  {e.organization ? (
                    <button
                      type="button"
                      className="text-sky-700 hover:underline"
                      onClick={() => onOpenCompany(e.organization!.id)}
                    >
                      {e.organization.name}
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2">{money(e.amount)}</td>
                <td className="px-4 py-2 text-xs text-slate-500">
                  {new Date(e.occurredAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AiUsagePanel({ onOpenCompany }: { onOpenCompany: (id: string) => void }) {
  const [data, setData] = useState<{
    metrics: { aiUsage: number };
    aiByTenant: { id: string; label: string; value: number }[];
  } | null>(null);
  useEffect(() => {
    void fetch("/api/platform/dashboards?panel=analytics")
      .then((r) => r.json())
      .then(setData);
  }, []);
  if (!data) return <div className="p-6 text-sm text-slate-500">Loading AI insights…</div>;
  return (
    <div className="space-y-4">
      <SectionHeader title="AI Insights" subtitle="Usage across tenants" />
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="AI events (30d)" value={data.metrics.aiUsage} accent="#8b5cf6" />
        <KpiCard label="Active AI tenants" value={data.aiByTenant.length} />
        <KpiCard label="Avg / tenant" value={data.aiByTenant.length ? Math.round(data.metrics.aiUsage / data.aiByTenant.length) : 0} />
      </div>
      <InteractiveBars
        title="AI usage by tenant"
        data={data.aiByTenant.map((a, i) => ({
          label: a.label.slice(0, 12),
          value: a.value,
          color: colorAt(i),
        }))}
        onSelect={(label) => {
          const hit = data.aiByTenant.find((a) => a.label.startsWith(label.slice(0, 8)));
          if (hit) onOpenCompany(hit.id);
        }}
      />
    </div>
  );
}

function AiPromptsPanel() {
  const [prompts, setPrompts] = useState([
    { id: "1", name: "Suggest reply", body: "Draft a concise, empathetic support reply." },
    { id: "2", name: "Summarize ticket", body: "Summarize the customer issue in 2 sentences." },
    { id: "3", name: "Macro expand", body: "Expand this macro with ticket context." },
  ]);
  return (
    <div className="space-y-4">
      <SectionHeader title="Prompts" subtitle="System prompts for AI assistants" />
      <ul className="space-y-3">
        {prompts.map((p) => (
          <li key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <input
              className="w-full border-0 text-sm font-semibold outline-none"
              value={p.name}
              onChange={(e) =>
                setPrompts((all) =>
                  all.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)),
                )
              }
            />
            <textarea
              rows={3}
              className="mt-2 w-full rounded-lg border border-slate-100 p-2 text-sm"
              value={p.body}
              onChange={(e) =>
                setPrompts((all) =>
                  all.map((x) => (x.id === p.id ? { ...x, body: e.target.value } : x)),
                )
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function AiModelsPanel() {
  const [provider, setProvider] = useState("openai_compatible");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [model, setModel] = useState("gpt-4o-mini");
  const [apiKey, setApiKey] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [configured, setConfigured] = useState(false);
  const [apiKeySet, setApiKeySet] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/ai/status");
    const data = await res.json();
    if (!res.ok) return;
    const c = data.config;
    setProvider(c.provider || "openai_compatible");
    setBaseUrl(c.baseUrl || "");
    setModel(c.model || "");
    setSystemPrompt(c.systemPrompt || "");
    setConfigured(Boolean(c.configured));
    setApiKeySet(Boolean(c.apiKeySet));
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    setBusy(true);
    setMsg(null);
    const payload: Record<string, unknown> = {
      provider,
      baseUrl,
      model,
      systemPrompt,
      temperature: 0.4,
      maxTokens: 800,
    };
    if (apiKey.trim()) payload.apiKey = apiKey.trim();
    const res = await fetch("/api/ai/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error || "Save failed");
      return;
    }
    setMsg("Saved AI model config");
    setApiKey("");
    await load();
  }

  async function ping() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/ai/status?ping=1");
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error || "Ping failed");
      return;
    }
    if (data.ping?.ok) setMsg(`Ping OK · model replied: ${data.ping.reply}`);
    else setMsg(data.ping?.error || "Ping failed — check URL/key/model");
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Your LLM"
        subtitle="OpenAI-compatible API — OpenAI, Azure, Ollama, vLLM, LM Studio, or any custom model endpoint"
      />
      <div className="max-w-2xl space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs text-slate-500">
          Status:{" "}
          <strong className={configured ? "text-emerald-700" : "text-amber-700"}>
            {configured ? "Connected" : "Not configured"}
          </strong>
          {apiKeySet ? " · API key set" : ""}
        </p>
        {msg ? (
          <p className="rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-900">{msg}</p>
        ) : null}
        <label className="block text-sm">
          Provider
          <select
            className="mt-1 w-full rounded border border-slate-200 px-3 py-2"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            <option value="openai_compatible">OpenAI-compatible (recommended)</option>
            <option value="openai">OpenAI</option>
            <option value="ollama">Ollama (local)</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>
        <label className="block text-sm">
          Base URL
          <input
            className="mt-1 w-full rounded border border-slate-200 px-3 py-2 font-mono text-xs"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1 or http://localhost:11434/v1"
          />
        </label>
        <label className="block text-sm">
          Model name
          <input
            className="mt-1 w-full rounded border border-slate-200 px-3 py-2 font-mono text-xs"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-4o-mini / llama3.2 / your-fine-tuned-id"
          />
        </label>
        <label className="block text-sm">
          API key {apiKeySet ? "(leave blank to keep current)" : ""}
          <input
            type="password"
            className="mt-1 w-full rounded border border-slate-200 px-3 py-2 font-mono text-xs"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-… or leave empty for Ollama"
          />
        </label>
        <label className="block text-sm">
          System prompt
          <textarea
            rows={3}
            className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Save model
          </button>
          <button
            type="button"
            disabled={busy || !configured}
            onClick={() => void ping()}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm disabled:opacity-50"
          >
            Test ping
          </button>
        </div>
        <p className="text-[11px] text-slate-400">
          Env fallbacks: LLM_BASE_URL, LLM_API_KEY, LLM_MODEL (or OPENAI_*). Agents use AI draft reply / summarize on tickets when the plan has AI Assistant.
        </p>
      </div>
    </div>
  );
}

function AiCostsPanel() {
  const series = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        label: `${i + 1}`,
        value: Math.round(12 + Math.sin(i / 2) * 8 + i),
      })),
    [],
  );
  return (
    <div className="space-y-4">
      <SectionHeader title="AI Costs" subtitle="Estimated spend (demo)" />
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="MTD" value="$184" accent="#8b5cf6" />
        <KpiCard label="Last month" value="$162" />
        <KpiCard label="Per ticket" value="$0.12" />
      </div>
      <AreaTrend title="Daily AI spend ($)" color="#8b5cf6" series={series} formatValue={(n) => `$${n}`} />
    </div>
  );
}

function IpManagementPanel({
  value,
  onSave,
}: {
  value: string;
  onSave: (field: string, value: string) => Promise<void>;
}) {
  let parsed: { allowlist?: string[]; blocklist?: string[] } = {};
  try {
    parsed = JSON.parse(value || "{}");
  } catch {
    parsed = {};
  }
  const [allow, setAllow] = useState((parsed.allowlist || []).join("\n"));
  const [block, setBlock] = useState((parsed.blocklist || []).join("\n"));
  return (
    <div className="space-y-4">
      <SectionHeader title="IP Management" subtitle="Allow / block lists for admin access" />
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold">Allowlist</div>
          <textarea
            rows={8}
            className="mt-2 w-full font-mono text-xs"
            value={allow}
            onChange={(e) => setAllow(e.target.value)}
            placeholder="1.2.3.4&#10;10.0.0.0/8"
          />
        </label>
        <label className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold">Blocklist</div>
          <textarea
            rows={8}
            className="mt-2 w-full font-mono text-xs"
            value={block}
            onChange={(e) => setBlock(e.target.value)}
          />
        </label>
      </div>
      <button
        type="button"
        className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white"
        onClick={() =>
          onSave(
            "securityJson",
            JSON.stringify({
              allowlist: allow.split("\n").map((s) => s.trim()).filter(Boolean),
              blocklist: block.split("\n").map((s) => s.trim()).filter(Boolean),
            }),
          )
        }
      >
        Save IP rules
      </button>
    </div>
  );
}

function BackupPanel({
  mode,
  onRefresh,
}: {
  mode: "backups" | "restore";
  onRefresh: () => void;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const backups = [
    { id: "bk-1", at: new Date(Date.now() - 864e5).toISOString(), size: "24 MB" },
    { id: "bk-2", at: new Date(Date.now() - 2 * 864e5).toISOString(), size: "23 MB" },
    { id: "bk-3", at: new Date(Date.now() - 7 * 864e5).toISOString(), size: "22 MB" },
  ];
  return (
    <div className="space-y-4">
      <SectionHeader
        title={mode === "backups" ? "Backups" : "Restore"}
        subtitle={
          mode === "backups"
            ? "Scheduled database snapshots"
            : "Restore from a snapshot (demo action)"
        }
        onRefresh={onRefresh}
      />
      {msg ? (
        <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900">{msg}</p>
      ) : null}
      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
        {backups.map((b) => (
          <li key={b.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <div>
              <div className="font-medium">{b.id}</div>
              <div className="text-xs text-slate-500">
                {new Date(b.at).toLocaleString()} · {b.size}
              </div>
            </div>
            {mode === "restore" ? (
              <button
                type="button"
                className="rounded-full border border-amber-200 px-3 py-1 text-xs text-amber-800"
                onClick={() => setMsg(`Restore queued for ${b.id} (demo)`)}
              >
                Restore
              </button>
            ) : (
              <button
                type="button"
                className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                onClick={() => setMsg(`Download started for ${b.id} (demo)`)}
              >
                Download
              </button>
            )}
          </li>
        ))}
      </ul>
      {mode === "backups" ? (
        <button
          type="button"
          className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white"
          onClick={() => setMsg("Manual backup started (demo)")}
        >
          Run backup now
        </button>
      ) : null}
    </div>
  );
}
