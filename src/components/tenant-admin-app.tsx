"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AreaTrend,
  HorizontalRank,
  InteractiveBars,
  InteractiveDonut,
  KpiCard,
  colorAt,
} from "@/components/platform-charts";
import {
  TENANT_ADMIN_NAV,
  tenantNavLabel,
  type TenantAdminNavId,
} from "@/lib/tenant-admin-nav";
import { ROLE_LABELS, ROLE_PERMISSIONS, PERMISSIONS } from "@/lib/permissions";
import type { MembershipRole } from "@prisma/client";
import { InviteMemberForm } from "@/components/admin-forms";
import { ApiKeysPanel } from "@/components/api-keys-panel";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { ChannelsHub } from "@/components/channels-hub";

type Snapshot = {
  organization: {
    id: string;
    name: string;
    slug: string;
    brandColor: string | null;
    logoUrl: string | null;
    customDomain: string | null;
    industry: string | null;
    country: string | null;
    timezone: string;
    plan: {
      key: string;
      name: string;
      seatLimit: number;
      features: Record<string, boolean>;
    };
    storageUsedBytes: number;
  };
  kpis: Record<string, number | null>;
  breakdowns: {
    byStatus: { label: string; value: number }[];
    byChannel: { label: string; value: number }[];
    byDepartment: { label: string; value: number }[];
  };
  members: {
    id: string;
    role: MembershipRole;
    roleLabel: string;
    disabled: boolean;
    user: { id: string; name: string; email: string };
  }[];
  departments: { id: string; name: string; tickets: number }[];
  teams: { id: string; name: string; department: string; agents: number }[];
  companies: {
    id: string;
    name: string;
    domain: string | null;
    _count: { contacts: number };
  }[];
  contacts: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    company: string | null;
  }[];
  recentTickets: {
    id: string;
    subject: string;
    status: string;
    priority: string;
    channel: string | null;
    department: string | null;
    assigneeId: string | null;
    escalatedAt: string | null;
    updatedAt: string;
  }[];
  slaPolicies: {
    id: string;
    name: string;
    priority: string | null;
    firstResponseMinutes: number;
    resolutionMinutes: number;
  }[];
  automationRules: {
    id: string;
    name: string;
    enabled: boolean;
    match: string;
    actions: string;
  }[];
  automationRuns: {
    successful: number;
    failed: number;
  };
  articles: {
    id: string;
    title: string;
    published: boolean;
    category: string | null;
    viewCount: number;
    helpfulVotes: number;
  }[];
  auditLogs: {
    id: string;
    action: string;
    createdAt: string;
    actor: { email: string; name: string } | null;
  }[];
  widgets: {
    ticketTrend: { label: string; created: number; resolved: number }[];
    agentLeaderboard: { id: string; label: string; value: number }[];
  };
  me: {
    id: string;
    email: string;
    name: string;
    role: MembershipRole;
  };
};

export function TenantAdminApp() {
  const [section, setSection] = useState<TenantAdminNavId>(() => {
    if (typeof window === "undefined") return "dashboard";
    const q = new URLSearchParams(window.location.search).get("section");
    if (q && TENANT_ADMIN_NAV.some(
      (g) => g.href === q || g.items?.some((i) => i.id === q),
    )) {
      return q as TenantAdminNavId;
    }
    return "dashboard";
  });
  const [navOpen, setNavOpen] = useState<Record<string, boolean>>({
    tickets: true,
    omni: true,
    crm: true,
    team: true,
    settings: true,
  });
  const [data, setData] = useState<Snapshot | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const res = await fetch("/api/tenant-admin");
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(json.error || "Failed to load");
      return;
    }
    setData(json);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("section") !== section) {
      url.searchParams.set("section", section);
      window.history.replaceState({}, "", url.toString());
    }
  }, [section]);

  const brand = data?.organization.brandColor || "#0c4a6e";

  if (!data) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-sm text-slate-500">
        Loading tenant admin…
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-0px)] bg-slate-100">
      <aside className="flex w-[250px] shrink-0 flex-col border-r border-slate-800 bg-slate-950 text-slate-100">
        <div className="border-b border-slate-800 px-4 py-4">
          <div className="flex items-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ background: brand }}
            >
              {data.organization.name.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">
                {data.organization.name}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-sky-300/80">
                Tenant Admin
              </div>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-2 overflow-y-auto p-2">
          {TENANT_ADMIN_NAV.map((group) => {
            if (group.href) {
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setSection(group.href!)}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${
                    section === group.href
                      ? "bg-sky-600 text-white"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <span className="w-5 text-center text-xs opacity-80">
                    {group.icon}
                  </span>
                  {group.label}
                </button>
              );
            }
            return (
              <div key={group.id}>
                <button
                  type="button"
                  onClick={() =>
                    setNavOpen((s) => ({ ...s, [group.id]: !s[group.id] }))
                  }
                  className="mb-0.5 flex w-full items-center justify-between px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                >
                  <span>
                    <span className="mr-1">{group.icon}</span>
                    {group.label}
                  </span>
                  <span>{navOpen[group.id] === false ? "+" : "–"}</span>
                </button>
                {navOpen[group.id] !== false ? (
                  <ul className="space-y-0.5">
                    {group.items?.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setSection(item.id)}
                          className={`w-full rounded-md px-3 py-1.5 pl-8 text-left text-sm ${
                            section === item.id
                              ? "bg-sky-600 text-white"
                              : "text-slate-300 hover:bg-slate-800"
                          }`}
                        >
                          {item.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </nav>
        <div className="border-t border-slate-800 p-3 text-xs text-slate-500">
          <div className="truncate text-slate-300">{data.me.name}</div>
          <div>{ROLE_LABELS[data.me.role] || data.me.role}</div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-5">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {tenantNavLabel(section)}
            </div>
            <div className="text-xs text-slate-500">
              {data.organization.name} · {data.organization.plan.name}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              disabled={busy}
              onClick={() => void load()}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-600"
            >
              Refresh
            </button>
            <Link
              href="/desk"
              className="rounded-full border border-slate-200 px-3 py-1.5 text-sky-700"
            >
              Agent desk
            </Link>
            <Link
              href="/desk/analytics"
              className="rounded-full bg-slate-900 px-3 py-1.5 text-white"
            >
              Full analytics
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-[radial-gradient(ellipse_at_top,_#e0f2fe_0%,_#f8fafc_50%,_#e2e8f0_100%)] p-5">
          {msg ? (
            <p className="mb-4 rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900">
              {msg}
            </p>
          ) : null}

          {section === "dashboard" ? (
            <DashboardHome data={data} onGoto={setSection} />
          ) : null}

          {section === "onboarding" ? <OnboardingChecklist /> : null}

          {section.startsWith("tickets-") ? (
            <TicketsPanel
              section={section}
              tickets={data.recentTickets}
              meId={data.me.id}
              kpis={data.kpis}
            />
          ) : null}

          {section === "omni-hub" ||
          section === "omni-email" ||
          section === "omni-whatsapp" ? (
            <ChannelsHub orgSlug={data.organization.slug} />
          ) : null}

          {section === "customers" ||
          section === "organizations" ||
          section === "contacts" ? (
            <CustomersPanel
              section={section}
              companies={data.companies}
              contacts={data.contacts}
              members={data.members.filter((m) =>
                ["customer", "customer_manager", "guest"].includes(m.role),
              )}
            />
          ) : null}

          {section === "users" || section === "roles" ? (
            <TeamPanel
              section={section}
              members={data.members}
              departments={data.departments}
              teams={data.teams}
              org={data.organization}
              onRefresh={load}
            />
          ) : null}

          {section === "knowledge" ? (
            <KnowledgePanel articles={data.articles} kpis={data.kpis} />
          ) : null}

          {section === "automation" ? (
            <AutomationPanel
              rules={data.automationRules}
              runs={data.automationRuns}
            />
          ) : null}

          {section === "reports" ? <ReportsPanel data={data} /> : null}

          {section === "billing" ? (
            <BillingPanel org={data.organization} kpis={data.kpis} />
          ) : null}

          {section.startsWith("settings-") ? (
            <SettingsPanel
              section={section}
              org={data.organization}
              sla={data.slaPolicies}
              onSaved={() => void load()}
            />
          ) : null}

          {section === "audit" ? (
            <AuditPanel logs={data.auditLogs} />
          ) : null}

          {section === "profile" ? <ProfilePanel me={data.me} /> : null}
        </main>
      </div>
    </div>
  );
}

function DashboardHome({
  data,
  onGoto,
}: {
  data: Snapshot;
  onGoto: (id: TenantAdminNavId) => void;
}) {
  const k = data.kpis;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {data.organization.name}
        </h1>
        <p className="text-sm text-slate-500">
          Company operations dashboard · {data.organization.plan.name} plan
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <KpiCard label="Open tickets" value={k.openTickets ?? 0} onClick={() => onGoto("tickets-all")} />
        <KpiCard label="Today's tickets" value={k.todaysTickets ?? 0} accent="#0ea5e9" />
        <KpiCard label="Resolved today" value={k.resolvedToday ?? 0} accent="#10b981" />
        <KpiCard label="Pending" value={k.pendingTickets ?? 0} accent="#f59e0b" />
        <KpiCard label="Overdue SLA" value={k.overdueTickets ?? 0} accent="#f43f5e" onClick={() => onGoto("tickets-escalated")} />
        <KpiCard label="CSAT" value={k.csat != null ? `${k.csat}/5` : "—"} accent="#8b5cf6" />
        <KpiCard label="Active agents" value={k.activeAgents ?? 0} onClick={() => onGoto("users")} />
        <KpiCard label="Live chats" value={k.liveChats ?? 0} onClick={() => onGoto("omni-hub")} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <KpiCard label="Total tickets" value={k.totalTickets ?? 0} />
        <KpiCard label="Resolved" value={k.resolvedTickets ?? 0} />
        <KpiCard label="Closed" value={k.closedTickets ?? 0} />
        <KpiCard label="SLA compliance" value={`${k.slaCompliance ?? 0}%`} accent="#10b981" />
        <KpiCard label="First response" value={`${k.firstResponseMins ?? 0}m`} />
        <KpiCard label="Resolution" value={`${k.resolutionHrs ?? 0}h`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AreaTrend
            title="Ticket trends · 7 days"
            color="#6366f1"
            series={data.widgets.ticketTrend.map((d) => ({
              label: d.label,
              value: d.created,
            }))}
          />
        </div>
        <InteractiveDonut
          title="By status"
          segments={data.breakdowns.byStatus.map((s, i) => ({
            label: s.label,
            value: s.value,
            color: colorAt(i),
          }))}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <HorizontalRank
          title="Agent leaderboard"
          rows={data.widgets.agentLeaderboard}
        />
        <InteractiveBars
          title="Channels"
          data={data.breakdowns.byChannel.map((c, i) => ({
            label: c.label,
            value: c.value,
            color: colorAt(i),
          }))}
        />
        <InteractiveBars
          title="Departments"
          data={data.breakdowns.byDepartment.map((c, i) => ({
            label: c.label,
            value: c.value,
            color: colorAt(i + 2),
          }))}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Recent activity</h3>
            <button
              type="button"
              className="text-xs text-sky-700"
              onClick={() => onGoto("tickets-all")}
            >
              View all
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {data.recentTickets.slice(0, 6).map((t) => (
              <li key={t.id}>
                <Link
                  href={`/desk/tickets/${t.id}`}
                  className="flex justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
                >
                  <span className="truncate font-medium">{t.subject}</span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {t.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold">Widgets</h3>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {[
              ["SLA breaches", String(k.overdueTickets ?? 0), "tickets-escalated"],
              ["KB views", String(k.knowledgeViews ?? 0), "knowledge"],
              ["AI usage", String(k.aiEvents30d ?? 0), "ai-analytics"],
              ["Automations OK", String(data.automationRuns.successful), "automation"],
              ["Unassigned", String(k.unassigned ?? 0), "tickets-unassigned"],
              ["Seats", `${k.seatsUsed}/${k.seatLimit}`, "billing"],
            ].map(([label, value, goto]) => (
              <button
                key={label}
                type="button"
                onClick={() => onGoto(goto as TenantAdminNavId)}
                className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-left hover:bg-sky-50"
              >
                <div className="text-[10px] uppercase text-slate-500">
                  {label}
                </div>
                <div className="font-semibold text-slate-900">{value}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TicketsPanel({
  section,
  tickets,
  meId,
  kpis,
}: {
  section: string;
  tickets: Snapshot["recentTickets"];
  meId: string;
  kpis: Snapshot["kpis"];
}) {
  const filtered = useMemo(() => {
    if (section === "tickets-mine")
      return tickets.filter((t) => t.assigneeId === meId);
    if (section === "tickets-unassigned")
      return tickets.filter((t) => !t.assigneeId);
    if (section === "tickets-escalated")
      return tickets.filter((t) => t.escalatedAt);
    if (section === "tickets-archived")
      return tickets.filter((t) => t.status === "closed");
    return tickets;
  }, [section, tickets, meId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{tenantNavLabel(section as TenantAdminNavId)}</h2>
          <p className="text-sm text-slate-500">
            Create, assign, merge, export from the agent desk inbox.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/desk?layout=list"
            className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white"
          >
            Open ticket workspace
          </Link>
          <Link
            href="/desk"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm"
          >
            Kanban
          </Link>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <KpiCard label="Open" value={kpis.openTickets ?? 0} />
        <KpiCard label="Pending" value={kpis.pendingTickets ?? 0} />
        <KpiCard label="Unassigned" value={kpis.unassigned ?? 0} />
        <KpiCard label="Escalated" value={kpis.escalated ?? 0} accent="#f43f5e" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Subject</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Priority</th>
              <th className="px-4 py-2">Channel</th>
              <th className="px-4 py-2">Dept</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link
                    href={`/desk/tickets/${t.id}`}
                    className="font-medium text-sky-700 hover:underline"
                  >
                    {t.subject}
                  </Link>
                </td>
                <td className="px-4 py-2 capitalize">{t.status}</td>
                <td className="px-4 py-2 capitalize">{t.priority}</td>
                <td className="px-4 py-2">{t.channel || "—"}</td>
                <td className="px-4 py-2">{t.department || "—"}</td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No tickets in this view
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {[
          "Create Ticket",
          "Assign/Reassign",
          "Merge",
          "Split",
          "Close/Reopen",
          "Internal Notes",
          "Attach Files",
          "Bulk Actions",
          "Export",
        ].map((a) => (
          <span
            key={a}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600"
          >
            {a}
          </span>
        ))}
      </div>
    </div>
  );
}

function CustomersPanel({
  section,
  companies,
  contacts,
  members,
}: {
  section: string;
  companies: Snapshot["companies"];
  contacts: Snapshot["contacts"];
  members: Snapshot["members"];
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {tenantNavLabel(section as TenantAdminNavId)}
        </h2>
        <Link href="/desk/contacts" className="text-sm text-sky-700">
          Open CRM →
        </Link>
      </div>
      {section === "organizations" || section === "customers" ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Organization</th>
                <th className="px-4 py-2">Domain</th>
                <th className="px-4 py-2">Contacts</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium">{c.name}</td>
                  <td className="px-4 py-2 text-xs">{c.domain || "—"}</td>
                  <td className="px-4 py-2">{c._count.contacts}</td>
                </tr>
              ))}
              {!companies.length ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                    No organizations yet
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
      {section === "contacts" || section === "customers" ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Contact</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Company</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium">{c.name}</td>
                  <td className="px-4 py-2 text-xs">{c.email}</td>
                  <td className="px-4 py-2">{c.company || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {section === "customers" ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold">Portal customers</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {members.map((m) => (
              <li key={m.id} className="flex justify-between">
                <span>
                  {m.user.name} · {m.user.email}
                </span>
                <span className="text-xs text-slate-500">{m.roleLabel}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function TeamPanel({
  section,
  members,
  departments,
  teams,
  org,
  onRefresh,
}: {
  section: string;
  members: Snapshot["members"];
  departments: Snapshot["departments"];
  teams: Snapshot["teams"];
  org: Snapshot["organization"];
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">
        {tenantNavLabel(section as TenantAdminNavId)}
      </h2>
      {section === "users" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold">Invite user</h3>
            <p className="mt-1 text-xs text-slate-500">
              Plan seats: {org.plan.seatLimit} on {org.plan.name}. Agent roles
              consume a seat; customer roles do not.
            </p>
            <div className="mt-3">
              <InviteMemberForm />
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <ul className="divide-y divide-slate-100">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <div>
                    <div className="font-medium">{m.user.name}</div>
                    <div className="text-xs text-slate-500">{m.user.email}</div>
                  </div>
                  <div className="text-right text-xs">
                    <div>{m.roleLabel}</div>
                    {m.disabled ? (
                      <div className="text-rose-600">disabled</div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      {section === "departments" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((d, i) => (
            <div
              key={d.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div
                className="mb-2 h-1.5 w-10 rounded-full"
                style={{ background: colorAt(i) }}
              />
              <div className="font-semibold">{d.name}</div>
              <div className="text-2xl font-semibold">{d.tickets}</div>
              <div className="text-xs text-slate-400">tickets</div>
            </div>
          ))}
        </div>
      ) : null}
      {section === "teams" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {teams.map((t, i) => (
            <div
              key={t.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="font-semibold">{t.name}</div>
              <div className="text-sm text-slate-500 capitalize">
                {t.department} · {t.agents} agents
              </div>
              <div
                className="mt-3 h-2 rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${colorAt(i)}, transparent)`,
                }}
              />
            </div>
          ))}
        </div>
      ) : null}
      {section === "roles" ? (
        <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2">Permission</th>
                {(
                  [
                    "admin",
                    "manager",
                    "supervisor",
                    "agent",
                    "qa",
                    "billing_manager",
                    "auditor",
                  ] as MembershipRole[]
                ).map((role) => (
                  <th key={role} className="px-2 py-2">
                    {ROLE_LABELS[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.slice(0, 30).map((perm) => (
                <tr key={perm} className="border-t border-slate-100">
                  <td className="px-3 py-1 font-mono text-[10px]">{perm}</td>
                  {(
                    [
                      "admin",
                      "manager",
                      "supervisor",
                      "agent",
                      "qa",
                      "billing_manager",
                      "auditor",
                    ] as MembershipRole[]
                  ).map((role) => (
                    <td key={role} className="px-2 py-1 text-center">
                      {ROLE_PERMISSIONS[role].includes(perm) ? "✓" : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <button type="button" onClick={onRefresh} className="text-sm text-sky-700">
        Refresh team data
      </button>
    </div>
  );
}

function KnowledgePanel({
  articles,
  kpis,
}: {
  articles: Snapshot["articles"];
  kpis: Snapshot["kpis"];
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h2 className="text-xl font-semibold">Knowledge Base</h2>
        <Link href="/desk/knowledge" className="text-sm text-sky-700">
          Manage articles →
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Articles" value={articles.length} />
        <KpiCard label="Views" value={kpis.knowledgeViews ?? 0} />
        <KpiCard label="Helpful votes" value={kpis.helpfulVotes ?? 0} />
      </div>
      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
        {articles.map((a) => (
          <li key={a.id} className="flex justify-between px-4 py-3 text-sm">
            <div>
              <div className="font-medium">{a.title}</div>
              <div className="text-xs text-slate-500">
                {a.category || "General"} · {a.published ? "Published" : "Draft"}
              </div>
            </div>
            <div className="text-xs text-slate-500">
              {a.viewCount} views · {a.helpfulVotes} helpful
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AutomationPanel({
  rules,
  runs,
}: {
  rules: Snapshot["automationRules"];
  runs: Snapshot["automationRuns"];
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h2 className="text-xl font-semibold">Automation</h2>
        <Link href="/desk/admin/automation" className="text-sm text-sky-700">
          Workflow builder →
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Rules" value={rules.length} />
        <KpiCard label="Successful runs" value={runs.successful} accent="#10b981" />
        <KpiCard label="Failed runs" value={runs.failed} accent="#f43f5e" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {[
          "Auto Assignment",
          "Round Robin",
          "Skill-Based Routing",
          "Auto Close",
          "Auto Reply",
          "Escalation Rules",
          "Scheduled Automations",
          "Workflow Builder",
        ].map((x, i) => (
          <div
            key={x}
            className="rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-sm"
          >
            <span
              className="mr-2 inline-block h-2 w-2 rounded-full"
              style={{ background: colorAt(i) }}
            />
            {x}
          </div>
        ))}
      </div>
      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
        {rules.map((r) => (
          <li key={r.id} className="flex justify-between px-4 py-3 text-sm">
            <span className="font-medium">{r.name}</span>
            <span className={r.enabled ? "text-emerald-600" : "text-slate-400"}>
              {r.enabled ? "enabled" : "disabled"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReportsPanel({ data }: { data: Snapshot }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h2 className="text-xl font-semibold">Reports & Analytics</h2>
        <Link href="/desk/analytics" className="text-sm text-sky-700">
          Open analytics center →
        </Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <AreaTrend
          title="Ticket volume"
          series={data.widgets.ticketTrend.map((d) => ({
            label: d.label,
            value: d.created,
          }))}
        />
        <AreaTrend
          title="Resolutions"
          color="#10b981"
          series={data.widgets.ticketTrend.map((d) => ({
            label: d.label,
            value: d.resolved,
          }))}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <InteractiveDonut
          title="Status"
          segments={data.breakdowns.byStatus.map((s, i) => ({
            ...s,
            color: colorAt(i),
          }))}
        />
        <InteractiveBars
          title="Channels"
          data={data.breakdowns.byChannel.map((c, i) => ({
            ...c,
            color: colorAt(i),
          }))}
        />
        <HorizontalRank
          title="Agent productivity"
          rows={data.widgets.agentLeaderboard}
        />
      </div>
    </div>
  );
}

function BillingPanel({
  org,
  kpis,
}: {
  org: Snapshot["organization"];
  kpis: Snapshot["kpis"];
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Billing & Subscription</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Current plan" value={org.plan.name} />
        <KpiCard
          label="Seats"
          value={`${kpis.seatsUsed}/${kpis.seatLimit}`}
        />
        <KpiCard
          label="Storage"
          value={`${(org.storageUsedBytes / 1024 / 1024).toFixed(1)} MB`}
        />
        <KpiCard label="AI credits" value={String(kpis.aiEvents30d ?? 0)} hint="Used (30d)" />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-600">
          Upgrade, downgrade, payment methods and invoices are managed in the
          billing tab of the classic admin console.
        </p>
        <Link
          href="/desk/admin"
          onClick={(e) => {
            // stay in tenant admin billing; also link to analytics if needed
            e.preventDefault();
          }}
          className="mt-3 inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm text-white"
        >
          Plan: {org.plan.key}
        </Link>
      </div>
    </div>
  );
}

function EmailInboundPanel({
  org,
}: {
  org: Snapshot["organization"];
}) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const endpoint = `${origin}/api/webhooks/inbound-email`;
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Email → tickets</h2>
      <p className="max-w-2xl text-sm text-slate-600">
        Point your inbound parse webhook (Resend, SendGrid, or similar) at this
        endpoint. Each email creates a ticket for{" "}
        <strong>{org.name}</strong> under channel <code>email</code>.
      </p>
      <div className="max-w-2xl space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-sm">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            POST endpoint
          </div>
          <code className="mt-1 block break-all rounded bg-slate-50 px-3 py-2 text-xs">
            {endpoint}
          </code>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Auth header
          </div>
          <code className="mt-1 block rounded bg-slate-50 px-3 py-2 text-xs">
            Authorization: Bearer &lt;CRON_SECRET or INBOUND_EMAIL_SECRET&gt;
          </code>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            JSON body
          </div>
          <pre className="mt-1 overflow-auto rounded bg-slate-50 px-3 py-2 text-xs leading-relaxed">{`{
  "org": "${org.slug}",
  "from": "customer@example.com",
  "subject": "Need help with billing",
  "text": "Full email body…"
}`}</pre>
        </div>
        <p className="text-xs text-slate-500">
          Set <code>CRON_SECRET</code> or <code>INBOUND_EMAIL_SECRET</code> in
          your deployment env. Org slug for this workspace:{" "}
          <strong>{org.slug}</strong>.
        </p>
      </div>
    </div>
  );
}

function SettingsPanel({
  section,
  org,
  sla,
  onSaved,
}: {
  section: string;
  org: Snapshot["organization"];
  sla: Snapshot["slaPolicies"];
  onSaved: () => void;
}) {
  const [name, setName] = useState(org.name);
  const [brandColor, setBrandColor] = useState(org.brandColor || "#0c4a6e");
  const [logoUrl, setLogoUrl] = useState(org.logoUrl || "");
  const [msg, setMsg] = useState<string | null>(null);

  async function saveOrg() {
    const res = await fetch("/api/org/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, brandColor, logoUrl: logoUrl || null }),
    });
    setMsg(res.ok ? "Saved" : "Failed to save");
    if (res.ok) onSaved();
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">
        {tenantNavLabel(section as TenantAdminNavId)}
      </h2>
      {msg ? (
        <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900">{msg}</p>
      ) : null}

      {(section === "settings-company" || section === "settings-branding") && (
        <div className="max-w-xl space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="block text-sm">
            Company name
            <input
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Brand color
            <input
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Logo URL
            <input
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
            />
          </label>
          <div className="text-xs text-slate-500">
            Industry: {org.industry || "—"} · Country: {org.country || "—"} ·
            Domain: {org.customDomain || "—"}
          </div>
          <button
            type="button"
            onClick={() => void saveOrg()}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white"
          >
            Save profile
          </button>
        </div>
      )}

      {section === "settings-hours" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm">Timezone: <strong>{org.timezone}</strong></div>
          <p className="mt-2 text-sm text-slate-500">
            Business hours and holidays drive SLA timers.
          </p>
        </div>
      )}

      {section === "settings-sla" && (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {sla.map((p) => (
            <li key={p.id} className="px-4 py-3 text-sm">
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-slate-500">
                First response {p.firstResponseMinutes}m · Resolution{" "}
                {p.resolutionMinutes}m
                {p.priority ? ` · ${p.priority}` : " · default"}
              </div>
            </li>
          ))}
        </ul>
      )}

      {section === "settings-email" && (
        <EmailInboundPanel org={org} />
      )}

      {section === "settings-api" && <ApiKeysPanel />}
    </div>
  );
}

function AuditPanel({ logs }: { logs: Snapshot["auditLogs"] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Audit Logs</h2>
      <ul className="max-h-[32rem] space-y-2 overflow-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {logs.map((l) => (
          <li key={l.id} className="border-b border-slate-50 pb-2 text-sm">
            <span className="font-medium">{l.action}</span>{" "}
            <span className="text-slate-500">
              {l.actor?.email || "system"} ·{" "}
              {new Date(l.createdAt).toLocaleString()}
            </span>
          </li>
        ))}
        {!logs.length ? (
          <li className="text-slate-400">No audit events for this org yet</li>
        ) : null}
      </ul>
    </div>
  );
}

function ProfilePanel({ me }: { me: Snapshot["me"] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Profile</h2>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-lg font-semibold">{me.name}</div>
        <div className="text-sm text-slate-500">{me.email}</div>
        <div className="mt-2 text-xs font-medium text-sky-700">
          {ROLE_LABELS[me.role] || me.role}
        </div>
      </div>
    </div>
  );
}
