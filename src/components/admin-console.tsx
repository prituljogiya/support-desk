"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Member = {
  id: string;
  role: string;
  user: { id: string; name: string; email: string };
};
type Invite = {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
};
type Canned = { id: string; title: string; body: string; keywords: string };
type Macro = {
  id: string;
  name: string;
  description: string | null;
  actions: string;
};
type Tag = { id: string; name: string; color: string };
type SlaPolicy = {
  id: string;
  name: string;
  priority: string | null;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  isDefault: boolean;
};
type PlanInfo = {
  key: string;
  name: string;
  description: string | null;
  seatLimit: number;
  features: Record<string, boolean>;
};

type ChartPoint = { label: string; value: number; color: string };

function BarChart({
  title,
  data,
  maxHint,
}: {
  title: string;
  data: ChartPoint[];
  maxHint?: number;
}) {
  const max = Math.max(maxHint ?? 0, ...data.map((d) => d.value), 1);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <div className="mt-4 flex h-40 items-end gap-2">
        {data.map((d) => (
          <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="text-xs font-semibold text-slate-700">{d.value}</div>
            <div
              className="w-full max-w-[48px] rounded-t-md transition-all duration-500"
              style={{
                height: `${Math.max(8, (d.value / max) * 100)}%`,
                background: d.color,
              }}
              title={`${d.label}: ${d.value}`}
            />
            <div className="truncate text-[10px] uppercase tracking-wide text-slate-500">
              {d.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutChart({
  title,
  segments,
}: {
  title: string;
  segments: ChartPoint[];
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let angle = 0;
  const gradient = segments
    .map((s) => {
      const start = angle;
      const sweep = (s.value / total) * 360;
      angle += sweep;
      return `${s.color} ${start}deg ${angle}deg`;
    })
    .join(", ");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <div className="mt-4 flex items-center gap-4">
        <div
          className="h-28 w-28 shrink-0 rounded-full"
          style={{
            background:
              total === 0
                ? "#e2e8f0"
                : `conic-gradient(${gradient})`,
          }}
        >
          <div className="m-[18px] flex h-[76px] w-[76px] items-center justify-center rounded-full bg-white text-center">
            <div>
              <div className="text-lg font-semibold text-slate-900">{total}</div>
              <div className="text-[10px] uppercase text-slate-400">total</div>
            </div>
          </div>
        </div>
        <ul className="space-y-1.5 text-sm">
          {segments.map((s) => (
            <li key={s.label} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: s.color }}
              />
              <span className="text-slate-600">{s.label}</span>
              <span className="ml-auto font-medium text-slate-900">{s.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "team", label: "Team" },
  { id: "smart", label: "Smart support" },
  { id: "sla", label: "SLA & tags" },
  { id: "settings", label: "Settings" },
  { id: "billing", label: "Billing" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AdminConsole({
  org,
  stats,
  members,
  invites,
  canned,
  macros,
  tags,
  policies,
  plans,
  currentPlan,
  seats,
  stripeConfigured,
  freshdeskConfigured,
  canFreshdesk,
  features,
}: {
  org: {
    id: string;
    name: string;
    slug: string;
    brandColor: string | null;
    logoUrl: string | null;
    freshdeskDomain: string | null;
    freshdeskApiKeySet: boolean;
  };
  stats: {
    open: number;
    pending: number;
    resolved: number;
    closed: number;
    syncErrors: number;
    unassigned: number;
    createdLast7Days: number[];
    dayLabels: string[];
  };
  members: Member[];
  invites: Invite[];
  canned: Canned[];
  macros: Macro[];
  tags: Tag[];
  policies: SlaPolicy[];
  plans: PlanInfo[];
  currentPlan: PlanInfo;
  seats: number;
  stripeConfigured: boolean;
  freshdeskConfigured: boolean;
  canFreshdesk: boolean;
  features: Record<string, boolean>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("overview");
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const statusChart = useMemo(
    () => [
      { label: "Open", value: stats.open, color: "#0284c7" },
      { label: "Pending", value: stats.pending, color: "#d97706" },
      { label: "Resolved", value: stats.resolved, color: "#059669" },
      { label: "Closed", value: stats.closed, color: "#64748b" },
    ],
    [stats],
  );

  const volumeChart = useMemo(
    () =>
      stats.dayLabels.map((label, i) => ({
        label,
        value: stats.createdLast7Days[i] ?? 0,
        color: "#0ea5e9",
      })),
    [stats],
  );

  async function api(
    url: string,
    init?: RequestInit,
    okMsg?: string,
  ): Promise<boolean> {
    setBusy(true);
    setError(null);
    setFlash(null);
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Request failed");
      return false;
    }
    if (okMsg) setFlash(okMsg);
    router.refresh();
    return true;
  }

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-gradient-to-br from-slate-50 via-sky-50/40 to-slate-100">
      <div className="border-b border-slate-200/80 bg-white/90 px-6 py-5 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-sky-700">
              Organization admin
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              {org.name}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage team, smart replies, SLA, Freshdesk, and plan — all in one place.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">
              {currentPlan.name} plan
            </span>
            <button
              type="button"
              onClick={() => setTab("billing")}
              className="rounded-lg bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800"
            >
              {currentPlan.key === "pro" ? "Manage plan" : "Assign Pro"}
            </button>
            <Link
              href="/desk/admin/automation"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Automations
            </Link>
            <Link
              href="/desk/knowledge"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Knowledge
            </Link>
            <Link
              href="/desk"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Back to inbox
            </Link>
          </div>
        </div>

        <nav className="mt-5 flex gap-1 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                tab === t.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="space-y-4 p-6">
        {flash ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {flash}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        ) : null}

        {tab === "overview" ? (
          <OverviewTab
            statusChart={statusChart}
            volumeChart={volumeChart}
            stats={stats}
            seats={seats}
            seatLimit={currentPlan.seatLimit}
            features={features}
            members={members.length}
            invites={invites.length}
            onGoBilling={() => setTab("billing")}
            planName={currentPlan.name}
          />
        ) : null}

        {tab === "team" ? (
          <TeamTab
            members={members}
            invites={invites}
            busy={busy}
            onInvite={async (email, role) => {
              const ok = await api(
                "/api/invites",
                { method: "POST", body: JSON.stringify({ email, role }) },
                "Invite created",
              );
              return ok;
            }}
          />
        ) : null}

        {tab === "smart" ? (
          <SmartTab
            canned={canned}
            macros={macros}
            tags={tags}
            features={features}
            busy={busy}
            onCreateCanned={(payload) =>
              api("/api/canned", { method: "POST", body: JSON.stringify(payload) }, "Canned response added")
            }
            onDeleteCanned={(id) =>
              api(`/api/canned?id=${id}`, { method: "DELETE" }, "Deleted")
            }
            onCreateMacro={(payload) =>
              api("/api/macros", { method: "POST", body: JSON.stringify(payload) }, "Macro added")
            }
            onDeleteMacro={(id) =>
              api(`/api/macros?id=${id}`, { method: "DELETE" }, "Macro deleted")
            }
          />
        ) : null}

        {tab === "sla" ? (
          <SlaTagsTab
            tags={tags}
            policies={policies}
            features={features}
            busy={busy}
            onCreateTag={(payload) =>
              api("/api/tags", { method: "POST", body: JSON.stringify(payload) }, "Tag added")
            }
            onDeleteTag={(id) =>
              api(`/api/tags?id=${id}`, { method: "DELETE" }, "Tag deleted")
            }
            onCreateSla={(payload) =>
              api("/api/sla", { method: "POST", body: JSON.stringify(payload) }, "SLA policy added")
            }
            onDeleteSla={(id) =>
              api(`/api/sla?id=${id}`, { method: "DELETE" }, "SLA deleted")
            }
            onGoBilling={() => setTab("billing")}
          />
        ) : null}

        {tab === "settings" ? (
          <SettingsTab
            org={org}
            canFreshdesk={canFreshdesk}
            freshdeskConfigured={freshdeskConfigured}
            busy={busy}
            onSave={(payload) =>
              api(
                "/api/org/settings",
                { method: "PATCH", body: JSON.stringify(payload) },
                "Settings saved",
              )
            }
            onSync={async () => {
              setBusy(true);
              const res = await fetch("/api/sync/retry", { method: "POST" });
              const data = await res.json();
              setBusy(false);
              if (!res.ok) {
                setError(data.error || "Sync failed");
                return;
              }
              setFlash(
                `Synced ${data.retried.tickets} tickets, ${data.retried.messages} messages; pulled ${data.pulled}`,
              );
              router.refresh();
            }}
            onGoBilling={() => setTab("billing")}
          />
        ) : null}

        {tab === "billing" ? (
          <BillingTab
            plans={plans}
            currentPlan={currentPlan}
            seats={seats}
            stripeConfigured={stripeConfigured}
            features={features}
            busy={busy}
            onAssign={async (planKey) => {
              const ok = await api(
                "/api/billing",
                { method: "POST", body: JSON.stringify({ planKey }) },
                `Plan set to ${planKey}`,
              );
              return ok;
            }}
            onCheckout={async (planKey) => {
              setBusy(true);
              const res = await fetch("/api/billing", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ planKey }),
              });
              const data = await res.json();
              setBusy(false);
              if (!res.ok) {
                setError(data.error || "Checkout failed");
                return;
              }
              window.location.href = data.url;
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function OverviewTab({
  statusChart,
  volumeChart,
  stats,
  seats,
  seatLimit,
  features,
  members,
  invites,
  onGoBilling,
  planName,
}: {
  statusChart: ChartPoint[];
  volumeChart: ChartPoint[];
  stats: {
    open: number;
    pending: number;
    unassigned: number;
    syncErrors: number;
  };
  seats: number;
  seatLimit: number;
  features: Record<string, boolean>;
  members: number;
  invites: number;
  onGoBilling: () => void;
  planName: string;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Open tickets", value: stats.open, tone: "text-sky-700" },
          { label: "Pending", value: stats.pending, tone: "text-amber-700" },
          { label: "Unassigned", value: stats.unassigned, tone: "text-rose-700" },
          { label: "Sync errors", value: stats.syncErrors, tone: "text-slate-700" },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className={`text-3xl font-semibold ${c.tone}`}>{c.value}</div>
            <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">
              {c.label}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DonutChart title="Tickets by status" segments={statusChart} />
        <BarChart title="New tickets · last 7 days" data={volumeChart} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800">Plan & seats</h3>
          <p className="mt-2 text-sm text-slate-600">
            Current plan: <strong>{planName}</strong>
          </p>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>Agent seats</span>
              <span>
                {seats} / {seatLimit}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-sky-600 transition-all"
                style={{
                  width: `${Math.min(100, (seats / Math.max(seatLimit, 1)) * 100)}%`,
                }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={onGoBilling}
            className="mt-4 rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-800"
          >
            Change plan / Assign Pro
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800">Feature gates</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(features).map(([k, v]) => (
              <span
                key={k}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  v
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-100 text-slate-500 line-through"
                }`}
              >
                {k}
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-500">
            {members} members · {invites} pending invites
          </p>
        </div>
      </div>
    </div>
  );
}

function TeamTab({
  members,
  invites,
  busy,
  onInvite,
}: {
  members: Member[];
  invites: Invite[];
  busy: boolean;
  onInvite: (email: string, role: string) => Promise<boolean>;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("agent");
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <form
        className="h-fit space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await onInvite(email, role);
          if (ok) {
            setLastInviteUrl(`/invite/(check list below)`);
            setEmail("");
          }
        }}
      >
        <h3 className="font-semibold text-slate-900">Invite teammate</h3>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@company.com"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-500"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="agent">Agent</option>
          <option value="admin">Admin</option>
          <option value="customer">Customer</option>
        </select>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60"
        >
          Send invite
        </button>
        {lastInviteUrl ? (
          <p className="text-xs text-slate-500">
            Copy the invite link from the pending list.
          </p>
        ) : null}
      </form>

      <div className="space-y-4">
        {invites.length > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
            <h3 className="text-sm font-semibold text-amber-900">
              Pending invites
            </h3>
            <ul className="mt-2 space-y-2">
              {invites.map((i) => (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm"
                >
                  <span>
                    {i.email} · <span className="uppercase text-xs">{i.role}</span>
                  </span>
                  <code className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                    /invite/{i.token}
                  </code>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">
            Members ({members.length})
          </div>
          <ul className="divide-y divide-slate-100">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-medium text-slate-900">{m.user.name}</div>
                  <div className="text-slate-500">{m.user.email}</div>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium uppercase text-slate-600">
                  {m.role}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function SmartTab({
  canned,
  macros,
  tags,
  features,
  busy,
  onCreateCanned,
  onDeleteCanned,
  onCreateMacro,
  onDeleteMacro,
}: {
  canned: Canned[];
  macros: Macro[];
  tags: Tag[];
  features: Record<string, boolean>;
  busy: boolean;
  onCreateCanned: (p: {
    title: string;
    body: string;
    keywords: string;
  }) => Promise<boolean>;
  onDeleteCanned: (id: string) => Promise<boolean>;
  onCreateMacro: (p: {
    name: string;
    description: string;
    actions: Record<string, unknown>;
  }) => Promise<boolean>;
  onDeleteMacro: (id: string) => Promise<boolean>;
}) {
  const [cTitle, setCTitle] = useState("");
  const [cBody, setCBody] = useState("");
  const [cKeywords, setCKeywords] = useState("");
  const [mName, setMName] = useState("");
  const [mDesc, setMDesc] = useState("");
  const [mStatus, setMStatus] = useState("resolved");
  const [mReply, setMReply] = useState("");
  const [mTagId, setMTagId] = useState("");

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Canned responses</h3>
          {!features.cannedResponses ? (
            <span className="text-xs text-amber-700">Plan gated</span>
          ) : null}
        </div>
        <form
          className="space-y-2 rounded-lg bg-slate-50 p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await onCreateCanned({
              title: cTitle,
              body: cBody,
              keywords: cKeywords,
            });
            if (ok) {
              setCTitle("");
              setCBody("");
              setCKeywords("");
            }
          }}
        >
          <input
            required
            value={cTitle}
            onChange={(e) => setCTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
          />
          <textarea
            required
            rows={3}
            value={cBody}
            onChange={(e) => setCBody(e.target.value)}
            placeholder="Reply body (use {{name}})"
            className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
          />
          <input
            value={cKeywords}
            onChange={(e) => setCKeywords(e.target.value)}
            placeholder="Keywords for suggest-reply"
            className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={busy || !features.cannedResponses}
            className="rounded bg-sky-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            Add canned
          </button>
        </form>
        <ul className="divide-y divide-slate-100">
          {canned.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-2 py-2 text-sm">
              <div>
                <div className="font-medium">{c.title}</div>
                <div className="line-clamp-2 text-xs text-slate-500">{c.body}</div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => onDeleteCanned(c.id)}
                className="text-xs text-rose-600 hover:underline"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Macros</h3>
          {!features.macros ? (
            <span className="text-xs text-amber-700">Requires Pro+</span>
          ) : null}
        </div>
        <form
          className="space-y-2 rounded-lg bg-slate-50 p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await onCreateMacro({
              name: mName,
              description: mDesc,
              actions: {
                status: mStatus,
                reply: mReply || null,
                addTagIds: mTagId ? [mTagId] : [],
              },
            });
            if (ok) {
              setMName("");
              setMDesc("");
              setMReply("");
              setMTagId("");
            }
          }}
        >
          <input
            required
            value={mName}
            onChange={(e) => setMName(e.target.value)}
            placeholder="Macro name"
            className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
          />
          <input
            value={mDesc}
            onChange={(e) => setMDesc(e.target.value)}
            placeholder="Description"
            className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
          />
          <select
            value={mStatus}
            onChange={(e) => setMStatus(e.target.value)}
            className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="open">Set open</option>
            <option value="pending">Set pending</option>
            <option value="resolved">Set resolved</option>
            <option value="closed">Set closed</option>
          </select>
          <select
            value={mTagId}
            onChange={(e) => setMTagId(e.target.value)}
            className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="">No tag</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                Add tag: {t.name}
              </option>
            ))}
          </select>
          <textarea
            rows={2}
            value={mReply}
            onChange={(e) => setMReply(e.target.value)}
            placeholder="Optional public reply"
            className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={busy || !features.macros}
            className="rounded bg-sky-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            Add macro
          </button>
        </form>
        <ul className="divide-y divide-slate-100">
          {macros.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-2 py-2 text-sm">
              <div>
                <div className="font-medium">{m.name}</div>
                <div className="text-xs text-slate-500">{m.description}</div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => onDeleteMacro(m.id)}
                className="text-xs text-rose-600 hover:underline"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function SlaTagsTab({
  tags,
  policies,
  features,
  busy,
  onCreateTag,
  onDeleteTag,
  onCreateSla,
  onDeleteSla,
  onGoBilling,
}: {
  tags: Tag[];
  policies: SlaPolicy[];
  features: Record<string, boolean>;
  busy: boolean;
  onCreateTag: (p: { name: string; color: string }) => Promise<boolean>;
  onDeleteTag: (id: string) => Promise<boolean>;
  onCreateSla: (p: {
    name: string;
    priority: string | null;
    firstResponseMinutes: number;
    resolutionMinutes: number;
    isDefault: boolean;
  }) => Promise<boolean>;
  onDeleteSla: (id: string) => Promise<boolean>;
  onGoBilling: () => void;
}) {
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("#0369a1");
  const [slaName, setSlaName] = useState("");
  const [slaPriority, setSlaPriority] = useState("");
  const [fr, setFr] = useState(120);
  const [res, setRes] = useState(480);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-semibold text-slate-900">Tags</h3>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await onCreateTag({ name: tagName, color: tagColor });
            if (ok) setTagName("");
          }}
        >
          <input
            required
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
            placeholder="Tag name"
            className="min-w-[140px] flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm"
          />
          <input
            type="color"
            value={tagColor}
            onChange={(e) => setTagColor(e.target.value)}
            className="h-9 w-12 rounded border border-slate-200"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-sky-700 px-3 py-1.5 text-sm text-white"
          >
            Add
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <button
              key={t.id}
              type="button"
              title="Click to delete"
              disabled={busy}
              onClick={() => onDeleteTag(t.id)}
              className="rounded-full px-3 py-1 text-xs font-medium text-white"
              style={{ background: t.color }}
            >
              {t.name} ×
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">SLA policies</h3>
          {!features.sla ? (
            <button
              type="button"
              onClick={onGoBilling}
              className="text-xs font-medium text-sky-700 hover:underline"
            >
              Unlock with Pro →
            </button>
          ) : null}
        </div>
        <form
          className="space-y-2 rounded-lg bg-slate-50 p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await onCreateSla({
              name: slaName,
              priority: slaPriority || null,
              firstResponseMinutes: fr,
              resolutionMinutes: res,
              isDefault: !slaPriority,
            });
            if (ok) {
              setSlaName("");
              setSlaPriority("");
            }
          }}
        >
          <input
            required
            value={slaName}
            onChange={(e) => setSlaName(e.target.value)}
            placeholder="Policy name"
            className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
            disabled={!features.sla}
          />
          <select
            value={slaPriority}
            onChange={(e) => setSlaPriority(e.target.value)}
            className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
            disabled={!features.sla}
          >
            <option value="">Default (all priorities)</option>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="urgent">urgent</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-500">
              First response (min)
              <input
                type="number"
                min={1}
                value={fr}
                onChange={(e) => setFr(Number(e.target.value))}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                disabled={!features.sla}
              />
            </label>
            <label className="text-xs text-slate-500">
              Resolution (min)
              <input
                type="number"
                min={1}
                value={res}
                onChange={(e) => setRes(Number(e.target.value))}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                disabled={!features.sla}
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={busy || !features.sla}
            className="rounded bg-sky-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            Add SLA policy
          </button>
        </form>
        <ul className="divide-y divide-slate-100 text-sm">
          {policies.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2">
              <span>
                {p.name}
                {p.isDefault ? " · default" : ""}
                {p.priority ? ` · ${p.priority}` : ""} · FR {p.firstResponseMinutes}m
                / Res {p.resolutionMinutes}m
              </span>
              <button
                type="button"
                disabled={busy || !features.sla}
                onClick={() => onDeleteSla(p.id)}
                className="text-xs text-rose-600 hover:underline"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function SettingsTab({
  org,
  canFreshdesk,
  freshdeskConfigured,
  busy,
  onSave,
  onSync,
  onGoBilling,
}: {
  org: {
    name: string;
    brandColor: string | null;
    logoUrl: string | null;
    freshdeskDomain: string | null;
    freshdeskApiKeySet: boolean;
    slug: string;
  };
  canFreshdesk: boolean;
  freshdeskConfigured: boolean;
  busy: boolean;
  onSave: (p: Record<string, unknown>) => Promise<boolean>;
  onSync: () => Promise<void>;
  onGoBilling: () => void;
}) {
  const [name, setName] = useState(org.name);
  const [brandColor, setBrandColor] = useState(org.brandColor || "#0c4a6e");
  const [logoUrl, setLogoUrl] = useState(org.logoUrl || "");
  const [freshdeskDomain, setFreshdeskDomain] = useState(
    org.freshdeskDomain || "",
  );
  const [freshdeskApiKey, setFreshdeskApiKey] = useState("");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            name,
            brandColor,
            logoUrl: logoUrl || null,
            freshdeskDomain: freshdeskDomain || null,
            ...(freshdeskApiKey ? { freshdeskApiKey } : {}),
          });
        }}
      >
        <h3 className="font-semibold text-slate-900">Branding & Freshdesk</h3>
        <label className="block text-sm">
          <span className="text-slate-500">Organization name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-500">Brand color</span>
          <div className="mt-1 flex gap-2">
            <input
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="h-10 w-12 rounded border"
            />
            <input
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2"
            />
          </div>
        </label>
        <label className="block text-sm">
          <span className="text-slate-500">Logo URL</span>
          <input
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        {canFreshdesk ? (
          <>
            <label className="block text-sm">
              <span className="text-slate-500">Freshdesk domain</span>
              <input
                value={freshdeskDomain}
                onChange={(e) => setFreshdeskDomain(e.target.value)}
                placeholder="yourcompany.freshdesk.com"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-500">Freshdesk API key</span>
              <input
                type="password"
                value={freshdeskApiKey}
                onChange={(e) => setFreshdeskApiKey(e.target.value)}
                placeholder={
                  org.freshdeskApiKeySet ? "Leave blank to keep current" : "API key"
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          </>
        ) : (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Freshdesk sync needs Pro.{" "}
            <button type="button" onClick={onGoBilling} className="underline">
              Assign Pro
            </button>
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
        >
          Save settings
        </button>
      </form>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-semibold text-slate-900">Sync status</h3>
        <p className="text-sm text-slate-600">
          Freshdesk:{" "}
          <strong
            className={
              freshdeskConfigured ? "text-emerald-700" : "text-amber-700"
            }
          >
            {freshdeskConfigured ? "Configured" : "Not configured"}
          </strong>
        </p>
        <p className="text-xs text-slate-500">
          Webhook tip: POST /api/webhooks/freshdesk?org={org.slug}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={onSync}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
        >
          Retry Freshdesk sync
        </button>
      </div>
    </div>
  );
}

function BillingTab({
  plans,
  currentPlan,
  seats,
  stripeConfigured,
  features,
  busy,
  onAssign,
  onCheckout,
}: {
  plans: PlanInfo[];
  currentPlan: PlanInfo;
  seats: number;
  stripeConfigured: boolean;
  features: Record<string, boolean>;
  busy: boolean;
  onAssign: (planKey: string) => Promise<boolean>;
  onCheckout: (planKey: string) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-sky-950">
              Current plan: {currentPlan.name}
            </h3>
            <p className="text-sm text-sky-800/80">
              {seats} / {currentPlan.seatLimit} agent seats ·{" "}
              {stripeConfigured
                ? "Stripe Checkout available"
                : "Manual plan assignment enabled (no Stripe keys)"}
            </p>
          </div>
          {currentPlan.key !== "pro" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onAssign("pro")}
              className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
            >
              {busy ? "…" : "Assign Pro now"}
            </button>
          ) : (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              Pro active — SLA, macros, Freshdesk unlocked
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(features).map(([k, v]) => (
            <span
              key={k}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                v ? "bg-white text-emerald-800" : "bg-sky-100/80 text-sky-700/70"
              }`}
            >
              {v ? "✓" : "–"} {k}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = p.key === currentPlan.key;
          const highlight = p.key === "pro";
          return (
            <div
              key={p.key}
              className={`relative flex flex-col rounded-xl border bg-white p-5 shadow-sm ${
                isCurrent
                  ? "border-sky-400 ring-2 ring-sky-200"
                  : highlight
                    ? "border-sky-300"
                    : "border-slate-200"
              }`}
            >
              {highlight ? (
                <span className="absolute -top-2 right-3 rounded-full bg-sky-700 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                  Recommended
                </span>
              ) : null}
              <h4 className="text-lg font-semibold text-slate-900">{p.name}</h4>
              <p className="mt-1 flex-1 text-sm text-slate-500">{p.description}</p>
              <p className="mt-3 text-xs text-slate-400">
                Up to {p.seatLimit} seats
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                {Object.entries(p.features)
                  .filter(([, v]) => v)
                  .map(([k]) => (
                    <span
                      key={k}
                      className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600"
                    >
                      {k}
                    </span>
                  ))}
              </div>
              {isCurrent ? (
                <div className="mt-4 text-center text-xs font-semibold uppercase text-sky-700">
                  Current plan
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onAssign(p.key)}
                  className={`mt-4 rounded-lg px-3 py-2 text-sm font-medium ${
                    highlight
                      ? "bg-sky-700 text-white hover:bg-sky-800"
                      : "border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {p.key === "pro"
                    ? "Assign Pro"
                    : p.key === "enterprise"
                      ? "Assign Enterprise"
                      : "Switch to Free"}
                </button>
              )}
              {stripeConfigured && !isCurrent && p.key !== "free" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onCheckout(p.key)}
                  className="mt-2 text-xs text-sky-700 hover:underline"
                >
                  Or pay with Stripe Checkout
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
