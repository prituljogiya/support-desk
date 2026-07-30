"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AreaTrend,
  HealthGauge,
  HorizontalRank,
  InteractiveBars,
  InteractiveDonut,
  KpiCard,
  colorAt,
} from "@/components/platform-charts";
import type { FeatureKey, PlanFeatures } from "@/lib/features";

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function PlatformDashboardsPanel({
  panel,
  onOpenTenant,
}: {
  panel: "revenue" | "health" | "billing" | "analytics" | "features";
  onOpenTenant?: (id: string) => void;
}) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    const res = await fetch(`/api/platform/dashboards?panel=${panel}`);
    const json = await res.json();
    setBusy(false);
    if (res.ok) setData(json);
    else setMsg(json.error || "Failed to load");
  }, [panel]);

  useEffect(() => {
    void load();
    if (panel === "health") {
      const t = setInterval(() => void load(), 15000);
      return () => clearInterval(t);
    }
  }, [load, panel]);

  async function toggleFeature(
    scope: "global" | "plan",
    key: FeatureKey,
    value: boolean,
    planKey?: string,
  ) {
    setBusy(true);
    const res = await fetch("/api/platform/dashboards", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope,
        planKey,
        features: { [key]: value },
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json();
      setMsg(j.error || "Update failed");
      return;
    }
    setMsg(`Updated ${key}`);
    await load();
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
        Loading {panel} dashboard…
      </div>
    );
  }

  if (panel === "revenue") {
    const d = data as {
      metrics: {
        mrr: number;
        arr: number;
        activeSubscriptions: number;
        churnRate: number;
        newCustomers: number;
        renewals: number;
        ltv: number;
        mrrGrowth: number;
      };
      mrrHistory: { label: string; value: number }[];
      byPlan: { label: string; value: number }[];
      topAccounts: {
        id: string;
        name: string;
        mrr: number;
        plan: string;
        seats: number;
      }[];
      recentNew: {
        id: string;
        name: string;
        mrr: number;
        plan: string;
        createdAt: string;
      }[];
    };
    return (
      <div className="space-y-5">
        {msg ? <Banner text={msg} /> : null}
        <Header
          title="Revenue Dashboard"
          subtitle="MRR, ARR, subscriptions, churn & LTV"
          onRefresh={load}
          busy={busy}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <KpiCard label="MRR" value={money(d.metrics.mrr)} hint={`${d.metrics.mrrGrowth}% MoM`} accent="#10b981" />
          <KpiCard label="ARR" value={money(d.metrics.arr)} hint="Annualized" accent="#059669" />
          <KpiCard label="Active subs" value={d.metrics.activeSubscriptions} />
          <KpiCard label="Churn rate" value={`${d.metrics.churnRate}%`} accent="#f43f5e" />
          <KpiCard label="New customers" value={d.metrics.newCustomers} accent="#0ea5e9" />
          <KpiCard label="Renewals" value={d.metrics.renewals} accent="#8b5cf6" />
          <KpiCard label="LTV" value={money(d.metrics.ltv)} hint="Est. lifetime value" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <AreaTrend title="MRR history" color="#10b981" series={d.mrrHistory} formatValue={money} />
          </div>
          <InteractiveDonut
            title="MRR by plan"
            segments={d.byPlan.map((p, i) => ({
              label: p.label,
              value: Math.round(p.value),
              color: colorAt(i),
            }))}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <HorizontalRank
            title="Top revenue accounts"
            formatValue={money}
            rows={d.topAccounts.map((a) => ({
              id: a.id,
              label: a.name,
              value: a.mrr,
              meta: `${a.plan} · ${a.seats} seats`,
            }))}
            onSelect={(id) => onOpenTenant?.(id)}
          />
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800">Recent customers</h3>
            <ul className="mt-3 space-y-2">
              {d.recentNew.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onOpenTenant?.(c.id)}
                    className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left hover:bg-slate-50"
                  >
                    <div>
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="text-xs text-slate-500">
                        {c.plan} · {new Date(c.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-sm font-semibold">{money(c.mrr)}</div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (panel === "health") {
    const d = data as {
      uptimeLabel: string;
      metrics: {
        key: string;
        label: string;
        value: number;
        unit: string;
        status: string;
        detail?: string;
      }[];
      trend: { label: string; api: number; cpu: number; queue: number }[];
    };
    const avgHealth = Math.round(
      (d.metrics.filter((m) => m.status === "healthy").length /
        Math.max(1, d.metrics.length)) *
        100,
    );
    return (
      <div className="space-y-5">
        <Header
          title="Platform Health"
          subtitle={`Live probes · uptime ${d.uptimeLabel} · auto-refresh 15s`}
          onRefresh={load}
          busy={busy}
        />
        <div className="grid gap-4 lg:grid-cols-4">
          <HealthGauge score={avgHealth} />
          <div className="lg:col-span-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {d.metrics.map((m) => (
              <div
                key={m.key}
                className={`rounded-2xl border bg-white p-4 shadow-sm ${
                  m.status === "healthy"
                    ? "border-emerald-100"
                    : "border-amber-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                    {m.label}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      m.status === "healthy"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {m.status}
                  </span>
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">
                  {m.value}
                  <span className="ml-1 text-sm font-normal text-slate-400">
                    {m.unit}
                  </span>
                </div>
                {m.detail ? (
                  <div className="mt-1 text-xs text-slate-500">{m.detail}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <AreaTrend
            title="API latency"
            color="#6366f1"
            series={d.trend.map((t) => ({ label: t.label, value: t.api }))}
            formatValue={(n) => `${n}ms`}
          />
          <AreaTrend
            title="CPU"
            color="#f59e0b"
            series={d.trend.map((t) => ({ label: t.label, value: t.cpu }))}
            formatValue={(n) => `${n}%`}
          />
          <AreaTrend
            title="Queue depth"
            color="#0ea5e9"
            series={d.trend.map((t) => ({ label: t.label, value: t.queue }))}
          />
        </div>
      </div>
    );
  }

  if (panel === "billing") {
    const d = data as {
      metrics: {
        paymentsReceived: number;
        pendingPayments: number;
        failedPayments: number;
        refunds: number;
        taxCollected: number;
        invoiceCount: number;
      };
      daily: { label: string; value: number }[];
      byType: { label: string; value: number; amount: number }[];
      events: {
        id: string;
        type: string;
        amount: number;
        tax: number;
        status: string;
        description: string | null;
        invoiceNumber: string | null;
        occurredAt: string;
        organization: { name: string; slug: string } | null;
      }[];
    };
    return (
      <div className="space-y-5">
        <Header
          title="Billing Dashboard"
          subtitle="Payments, refunds, invoices & tax"
          onRefresh={load}
          busy={busy}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="Payments received" value={money(d.metrics.paymentsReceived)} accent="#10b981" />
          <KpiCard label="Pending" value={money(d.metrics.pendingPayments)} accent="#f59e0b" />
          <KpiCard label="Failed" value={money(d.metrics.failedPayments)} accent="#f43f5e" />
          <KpiCard label="Refunds" value={money(d.metrics.refunds)} accent="#8b5cf6" />
          <KpiCard label="Tax collected" value={money(d.metrics.taxCollected)} />
          <KpiCard label="Invoices" value={d.metrics.invoiceCount} hint="Downloadable records" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <AreaTrend title="Payments · 14 days" color="#10b981" series={d.daily} formatValue={money} />
          </div>
          <InteractiveDonut
            title="Events by type"
            segments={d.byType.map((t, i) => ({
              label: t.label,
              value: t.value,
              color: colorAt(i),
            }))}
          />
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold">Ledger</h3>
            <button
              type="button"
              className="rounded-full border border-slate-200 px-3 py-1 text-xs"
              onClick={() => {
                const rows = [
                  ["date", "type", "org", "amount", "tax", "invoice", "status"],
                  ...d.events.map((e) => [
                    new Date(e.occurredAt).toISOString(),
                    e.type,
                    e.organization?.slug || "",
                    String(e.amount),
                    String(e.tax),
                    e.invoiceNumber || "",
                    e.status,
                  ]),
                ];
                const csv = rows.map((r) => r.join(",")).join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "billing-ledger.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download CSV / tax report
            </button>
          </div>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Organization</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Invoice</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {d.events.map((e) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {new Date(e.occurredAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 capitalize">{e.type}</td>
                  <td className="px-4 py-2">{e.organization?.name || "—"}</td>
                  <td className="px-4 py-2 font-medium">{money(e.amount)}</td>
                  <td className="px-4 py-2 text-xs">{e.invoiceNumber || "—"}</td>
                  <td className="px-4 py-2 text-xs">{e.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (panel === "analytics") {
    const d = data as {
      metrics: {
        activeCompanies: number;
        totalTickets: number;
        aiUsage: number;
        agentsOnline: number;
        featureAvgAdoption: number;
      };
      ticketsByTenant: { id: string; label: string; value: number; meta?: string }[];
      topCustomers: { id: string; label: string; value: number; meta?: string }[];
      aiByTenant: { id: string; label: string; value: number }[];
      revenueGrowth: { label: string; value: number }[];
      systemLoad: { label: string; value: number }[];
      agentActivity: {
        name: string;
        email: string;
        org: string;
        role: string;
        tickets: number;
      }[];
      featureAdoption: {
        key: string;
        label: string;
        adoptionPct: number;
        tenantsWithFeature: number;
      }[];
    };
    return (
      <div className="space-y-5">
        <Header
          title="Platform Analytics"
          subtitle="Companies, tickets, AI, agents & adoption"
          onRefresh={load}
          busy={busy}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard label="Active companies" value={d.metrics.activeCompanies} />
          <KpiCard label="Tickets" value={d.metrics.totalTickets} accent="#6366f1" />
          <KpiCard label="AI usage" value={d.metrics.aiUsage} accent="#8b5cf6" />
          <KpiCard label="Agents" value={d.metrics.agentsOnline} accent="#0ea5e9" />
          <KpiCard label="Feature adoption" value={`${d.metrics.featureAvgAdoption}%`} accent="#10b981" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <AreaTrend title="Revenue growth" color="#10b981" series={d.revenueGrowth} formatValue={money} />
          <AreaTrend title="System load (CPU)" color="#f59e0b" series={d.systemLoad} formatValue={(n) => `${n}%`} />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <HorizontalRank
            title="Tickets by tenant"
            rows={d.ticketsByTenant}
            onSelect={(id) => onOpenTenant?.(id)}
          />
          <HorizontalRank
            title="Top customers"
            formatValue={money}
            rows={d.topCustomers}
            onSelect={(id) => onOpenTenant?.(id)}
          />
          <InteractiveBars
            title="AI usage by tenant"
            data={d.aiByTenant.map((a, i) => ({
              label: a.label.slice(0, 10),
              value: a.value,
              color: colorAt(i),
            }))}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold">Agent activity</h3>
            <ul className="mt-3 max-h-72 space-y-2 overflow-auto text-sm">
              {d.agentActivity.map((a) => (
                <li
                  key={`${a.email}-${a.org}`}
                  className="flex items-center justify-between gap-2 border-b border-slate-50 pb-2"
                >
                  <div>
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-slate-500">
                      {a.org} · {a.role}
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-slate-700">
                    {a.tickets} tickets
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <InteractiveBars
            title="Feature adoption %"
            data={d.featureAdoption.slice(0, 10).map((f, i) => ({
              label: f.label.slice(0, 12),
              value: f.adoptionPct,
              color: colorAt(i),
            }))}
          />
        </div>
      </div>
    );
  }

  // features
  const d = data as {
    global: PlanFeatures;
    keys: FeatureKey[];
    labels: Record<FeatureKey, string>;
    plans: {
      id: string;
      key: string;
      name: string;
      seatLimit: number;
      features: PlanFeatures;
    }[];
  };

  return (
    <div className="space-y-5">
      {msg ? <Banner text={msg} /> : null}
      <Header
        title="Feature Management"
        subtitle="Toggle capabilities globally or per plan"
        onRefresh={load}
        busy={busy}
      />
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold">Global kill switches</h3>
        <p className="mt-1 text-xs text-slate-500">
          Platform-wide defaults recorded for rollout control (plans remain source of truth for tenants).
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {d.keys.map((key) => (
            <label
              key={key}
              className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm"
            >
              <span>{d.labels[key]}</span>
              <input
                type="checkbox"
                checked={Boolean(d.global[key])}
                disabled={busy}
                onChange={(e) =>
                  toggleFeature("global", key, e.target.checked)
                }
              />
            </label>
          ))}
        </div>
      </div>

      <div className="overflow-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-3">Feature</th>
              {d.plans.map((p) => (
                <th key={p.key} className="px-3 py-3 font-semibold text-slate-700">
                  {p.name}
                  <div className="font-normal text-[10px]">{p.seatLimit} seats</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.keys.map((key) => (
              <tr key={key} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-800">
                  {d.labels[key]}
                </td>
                {d.plans.map((p) => (
                  <td key={p.key} className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={Boolean(p.features[key])}
                      disabled={busy}
                      onChange={(e) =>
                        toggleFeature("plan", key, e.target.checked, p.key)
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Header({
  title,
  subtitle,
  onRefresh,
  busy,
}: {
  title: string;
  subtitle: string;
  onRefresh: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          {title}
        </h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={onRefresh}
        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      >
        Refresh
      </button>
    </div>
  );
}

function Banner({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
      {text}
    </p>
  );
}
