"use client";

import { useEffect, useMemo, useState } from "react";

type Snapshot = Awaited<ReturnType<typeof import("@/lib/analytics").buildAnalyticsSnapshot>>;

const DASHBOARDS = [
  { id: "executive", label: "Executive" },
  { id: "status", label: "Ticket Status" },
  { id: "trend", label: "Daily Trend" },
  { id: "agents", label: "Agent Performance" },
  { id: "volume", label: "Volume" },
  { id: "sla", label: "SLA" },
  { id: "response", label: "Response Time" },
  { id: "csat", label: "CSAT / NPS" },
  { id: "channels", label: "Channels" },
  { id: "priority", label: "Priority" },
  { id: "departments", label: "Departments" },
  { id: "ai", label: "AI" },
  { id: "knowledge", label: "Knowledge" },
  { id: "automation", label: "Automation" },
  { id: "customers", label: "Customers" },
  { id: "business", label: "Business" },
  { id: "subscription", label: "Subscription" },
  { id: "realtime", label: "Real-Time" },
  { id: "geo", label: "Geographic" },
  { id: "custom", label: "Custom Builder" },
  { id: "reports", label: "Export Center" },
] as const;

type DashId = (typeof DASHBOARDS)[number]["id"];

const WIDGET_CATALOG = [
  { id: "kpi_tickets", label: "Ticket KPIs" },
  { id: "sla_gauge", label: "SLA Compliance" },
  { id: "agent_board", label: "Agent Leaderboard" },
  { id: "csat_score", label: "CSAT Score" },
  { id: "ai_usage", label: "AI Usage" },
  { id: "ticket_queue", label: "Ticket Queue" },
  { id: "trend", label: "Ticket Trend" },
  { id: "channels", label: "Channels" },
  { id: "automation", label: "Automation Status" },
  { id: "knowledge", label: "Knowledge Performance" },
  { id: "geo", label: "Geographic" },
  { id: "revenue", label: "Revenue" },
] as const;

function Bar({
  data,
  valueKey = "value",
}: {
  data: { label: string; value?: number; created?: number; resolved?: number; pending?: number }[];
  valueKey?: "value" | "created" | "resolved" | "pending";
}) {
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey] ?? 0)));
  return (
    <div className="flex h-44 items-end gap-1.5">
      {data.map((d) => {
        const v = Number(d[valueKey] ?? 0);
        return (
          <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="text-[10px] font-semibold text-slate-600">{v}</div>
            <div
              className="w-full max-w-[36px] rounded-t bg-sky-500"
              style={{ height: `${Math.max(6, (v / max) * 100)}%` }}
              title={`${d.label}: ${v}`}
            />
            <div className="w-full truncate text-center text-[9px] text-slate-400">
              {d.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Donut({
  data,
  colors,
}: {
  data: { label: string; value: number }[];
  colors: string[];
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let angle = 0;
  const gradient = data
    .map((d, i) => {
      const start = angle;
      angle += (d.value / total) * 360;
      return `${colors[i % colors.length]} ${start}deg ${angle}deg`;
    })
    .join(", ");
  return (
    <div className="flex items-center gap-4">
      <div
        className="h-32 w-32 shrink-0 rounded-full"
        style={{ background: `conic-gradient(${gradient || "#e2e8f0"})` }}
      >
        <div className="m-5 flex h-[88px] w-[88px] items-center justify-center rounded-full bg-white text-sm font-semibold">
          {total}
        </div>
      </div>
      <ul className="space-y-1 text-sm">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: colors[i % colors.length] }}
            />
            <span className="text-slate-600">{d.label}</span>
            <span className="ml-auto font-medium">
              {d.value} ({Math.round((d.value / total) * 100)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Card({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-2xl font-semibold tracking-tight text-slate-900">
        {value}
      </div>
      <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      {hint ? <div className="mt-1 text-xs text-slate-400">{hint}</div> : null}
    </div>
  );
}

function Gauge({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-slate-500">SLA</span>
        <span className="font-semibold text-slate-900">{pct}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${
            pct >= 95 ? "bg-emerald-500" : pct >= 85 ? "bg-amber-500" : "bg-rose-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const COLORS = [
  "#0284c7",
  "#d97706",
  "#059669",
  "#64748b",
  "#7c3aed",
  "#db2777",
  "#0f766e",
  "#b45309",
];

export function AnalyticsCenter() {
  const [dash, setDash] = useState<DashId>("executive");
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("30");
  const [agentId, setAgentId] = useState("");
  const [department, setDepartment] = useState("");
  const [channel, setChannel] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");
  const [volumeMode, setVolumeMode] = useState<"day" | "week" | "month" | "quarter" | "year">("day");
  const [widgets, setWidgets] = useState<string[]>(() => {
    if (typeof window === "undefined") return ["kpi_tickets", "sla_gauge", "csat_score", "trend"];
    try {
      return JSON.parse(localStorage.getItem("sd-custom-dash") || "null") ?? [
        "kpi_tickets",
        "sla_gauge",
        "csat_score",
        "trend",
      ];
    } catch {
      return ["kpi_tickets", "sla_gauge", "csat_score", "trend"];
    }
  });

  async function load() {
    setLoading(true);
    setError(null);
    const to = new Date();
    const from = new Date(Date.now() - Number(range) * 86400000);
    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
    });
    if (agentId) params.set("agentId", agentId);
    if (department) params.set("department", department);
    if (channel) params.set("channel", channel);
    if (companyId) params.set("companyId", companyId);
    if (priority) params.set("priority", priority);
    if (status) params.set("status", status);
    const res = await fetch(`/api/analytics?${params}`);
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error || "Failed to load analytics");
      return;
    }
    setData(json);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, agentId, department, channel, companyId, priority, status]);

  useEffect(() => {
    if (dash !== "realtime") return;
    const id = setInterval(() => void load(), 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dash, range, agentId, department, channel]);

  function toggleWidget(id: string) {
    setWidgets((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem("sd-custom-dash", JSON.stringify(next));
      return next;
    });
  }

  function exportCsv() {
    if (!data) return;
    const rows = [
      ["metric", "value"],
      ["totalTickets", data.executive.totalTickets],
      ["openTickets", data.executive.openTickets],
      ["closedToday", data.executive.closedToday],
      ["slaCompliance", data.executive.slaCompliance],
      ["avgResponseMin", data.executive.avgResponseMin],
      ["avgResolutionHrs", data.executive.avgResolutionHrs],
      ["csat", data.executive.csat],
      ["nps", data.csat.nps],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "analytics-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function printPdf() {
    window.print();
  }

  const volumeSeries = useMemo(() => {
    if (!data) return [];
    if (volumeMode === "day") {
      return data.dailyTrend.map((d) => ({
        label: d.label,
        value: d.created,
        created: d.created,
        resolved: d.resolved,
      }));
    }
    return data.volume[volumeMode].map((d) => ({
      label: d.label,
      value: d.created,
      created: d.created,
      resolved: d.resolved,
    }));
  }, [data, volumeMode]);

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-gradient-to-br from-slate-100 via-sky-50/40 to-slate-50">
      <div className="border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur print:hidden">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
              Enterprise analytics
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">
              Operations intelligence
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Executive, SLA, agents, CSAT, channels, AI, automation, and more.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={printPdf}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Print / PDF
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-lg bg-sky-700 px-3 py-1.5 text-sm text-white hover:bg-sky-800"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="rounded border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="rounded border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="">All agents</option>
            {(data?.meta.agents ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="rounded border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="">All departments</option>
            {(data?.meta.departments ?? []).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="rounded border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="">All channels</option>
            {(data?.meta.channels ?? []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="rounded border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="">All companies</option>
            {(data?.meta.companies ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="rounded border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="">All priorities</option>
            {["low", "medium", "high", "urgent"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="">All statuses</option>
            {["open", "pending", "resolved", "closed"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <nav className="mt-4 flex gap-1 overflow-x-auto pb-1">
          {DASHBOARDS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDash(d.id)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${
                dash === d.id
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {d.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="space-y-4 p-4 print:p-0">
        {loading && !data ? (
          <p className="text-sm text-slate-500">Loading analytics…</p>
        ) : null}
        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        {data ? (
          <>
            {dash === "executive" ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
                  <Kpi label="Total Tickets" value={data.executive.totalTickets} />
                  <Kpi label="Open Tickets" value={data.executive.openTickets} />
                  <Kpi label="Closed Today" value={data.executive.closedToday} />
                  <Kpi
                    label="SLA Compliance"
                    value={`${data.executive.slaCompliance}%`}
                  />
                  <Kpi
                    label="Avg Response"
                    value={`${data.executive.avgResponseMin} min`}
                  />
                  <Kpi
                    label="Avg Resolution"
                    value={`${data.executive.avgResolutionHrs} hrs`}
                  />
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card title="Customer Satisfaction (CSAT)">
                    <div className="text-3xl font-semibold text-amber-600">
                      {"★".repeat(Math.round(data.executive.csat || 0))}
                      <span className="ml-2 text-slate-900">
                        {data.executive.csat || "—"} / 5
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      Based on {data.executive.csatCount} ratings · NPS{" "}
                      {data.csat.nps}
                    </p>
                  </Card>
                  <Card title="SLA gauge">
                    <Gauge value={data.sla.compliance} />
                    <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
                      <div>
                        <div className="text-lg font-semibold text-emerald-700">
                          {data.sla.met}
                        </div>
                        Met
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-rose-700">
                          {data.sla.breached}
                        </div>
                        Breached
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-amber-700">
                          {data.sla.nearBreach}
                        </div>
                        Near
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-slate-700">
                          {data.sla.escalated}
                        </div>
                        Escalated
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            ) : null}

            {dash === "status" ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Ticket status distribution">
                  <Donut data={data.status} colors={COLORS} />
                </Card>
                <Card title="Status counts">
                  <Bar data={data.status} />
                </Card>
              </div>
            ) : null}

            {dash === "trend" ? (
              <div className="grid gap-4">
                <Card title="Daily ticket trend — created / resolved / pending">
                  <div className="mb-3 flex gap-4 text-xs">
                    <span className="text-sky-700">Created</span>
                    <span className="text-emerald-700">Resolved</span>
                    <span className="text-amber-700">Pending</span>
                  </div>
                  <div className="flex h-48 items-end gap-1">
                    {data.dailyTrend.map((d) => {
                      const max = Math.max(
                        1,
                        ...data.dailyTrend.flatMap((x) => [
                          x.created,
                          x.resolved,
                          x.pending,
                        ]),
                      );
                      return (
                        <div
                          key={d.label}
                          className="flex flex-1 flex-col items-center gap-1"
                        >
                          <div className="flex h-36 w-full items-end justify-center gap-0.5">
                            <div
                              className="w-1.5 rounded-t bg-sky-500"
                              style={{
                                height: `${(d.created / max) * 100}%`,
                              }}
                            />
                            <div
                              className="w-1.5 rounded-t bg-emerald-500"
                              style={{
                                height: `${(d.resolved / max) * 100}%`,
                              }}
                            />
                            <div
                              className="w-1.5 rounded-t bg-amber-500"
                              style={{
                                height: `${(d.pending / max) * 100}%`,
                              }}
                            />
                          </div>
                          <div className="text-[9px] text-slate-400">{d.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            ) : null}

            {dash === "agents" ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Kpi
                    label="Top Agent"
                    value={data.agents[0]?.name ?? "—"}
                    hint={`${data.agents[0]?.closed ?? 0} closed`}
                  />
                  <Kpi
                    label="Lowest Response"
                    value={`${
                      [...data.agents]
                        .filter((a) => a.avgFirstResponseMin > 0)
                        .sort(
                          (a, b) =>
                            a.avgFirstResponseMin - b.avgFirstResponseMin,
                        )[0]?.avgFirstResponseMin ?? "—"
                    } min`}
                    hint={
                      [...data.agents]
                        .filter((a) => a.avgFirstResponseMin > 0)
                        .sort(
                          (a, b) =>
                            a.avgFirstResponseMin - b.avgFirstResponseMin,
                        )[0]?.name
                    }
                  />
                  <Kpi
                    label="Highest CSAT"
                    value={
                      [...data.agents].sort((a, b) => b.csat - a.csat)[0]
                        ?.csat ?? "—"
                    }
                    hint={
                      [...data.agents].sort((a, b) => b.csat - a.csat)[0]?.name
                    }
                  />
                </div>
                <Card title="Agent performance">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b text-xs uppercase text-slate-500">
                        <tr>
                          <th className="py-2">Agent</th>
                          <th>Assigned</th>
                          <th>Closed</th>
                          <th>Pending</th>
                          <th>SLA</th>
                          <th>CSAT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.agents.map((a) => (
                          <tr key={a.id} className="border-b border-slate-50">
                            <td className="py-2 font-medium">{a.name}</td>
                            <td>{a.assigned}</td>
                            <td>{a.closed}</td>
                            <td>{a.pending}</td>
                            <td>{a.sla}%</td>
                            <td>★ {a.csat || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            ) : null}

            {dash === "volume" ? (
              <Card
                title="Ticket volume analytics"
                action={
                  <select
                    value={volumeMode}
                    onChange={(e) =>
                      setVolumeMode(e.target.value as typeof volumeMode)
                    }
                    className="rounded border border-slate-200 px-2 py-1 text-xs"
                  >
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                    <option value="quarter">Quarter</option>
                    <option value="year">Year</option>
                  </select>
                }
              >
                <Bar data={volumeSeries} valueKey="created" />
              </Card>
            ) : null}

            {dash === "sla" ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="SLA dashboard">
                  <Gauge value={data.sla.compliance} />
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <Kpi label="SLA Met" value={data.sla.met} />
                    <Kpi label="SLA Breached" value={data.sla.breached} />
                    <Kpi label="Near Breach" value={data.sla.nearBreach} />
                    <Kpi label="Escalated" value={data.sla.escalated} />
                  </div>
                </Card>
                <Card title="Upcoming SLA risk">
                  <p className="text-sm text-slate-600">
                    {data.sla.nearBreach} tickets within 2 hours of breach.
                    Monitor the Kanban SLA chips for FR / Res countdowns.
                  </p>
                </Card>
              </div>
            ) : null}

            {dash === "response" ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi
                  label="First Response Time"
                  value={`${data.response.firstResponseMin} min`}
                />
                <Kpi
                  label="Avg Response Time"
                  value={`${data.response.avgResponseMin} min`}
                />
                <Kpi
                  label="Resolution Time"
                  value={`${data.response.resolutionHrs} hrs`}
                />
                <Kpi
                  label="Today vs Yesterday FR"
                  value={`${data.response.todayFirst} / ${data.response.yesterdayFirst} min`}
                />
              </div>
            ) : null}

            {dash === "csat" ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="CSAT & NPS">
                  <div className="text-3xl font-semibold">
                    {data.csat.average} / 5
                  </div>
                  <p className="text-sm text-slate-500">NPS {data.csat.nps}</p>
                  <div className="mt-4">
                    <Bar data={data.csat.distribution} />
                  </div>
                </Card>
                <Card title="Feedback analysis">
                  <ul className="space-y-2 text-sm">
                    {data.csat.feedback.length === 0 ? (
                      <li className="text-slate-400">No comments yet</li>
                    ) : (
                      data.csat.feedback.map((f, i) => (
                        <li key={i} className="rounded border border-slate-100 p-2">
                          <div className="font-medium">
                            ★{f.score} · {f.ticket}
                          </div>
                          <div className="text-slate-500">{f.comment}</div>
                        </li>
                      ))
                    )}
                  </ul>
                </Card>
              </div>
            ) : null}

            {dash === "channels" ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Ticket source (channel)">
                  <Donut data={data.channels} colors={COLORS} />
                </Card>
                <Card title="Channel mix">
                  <Bar data={data.channels} />
                </Card>
              </div>
            ) : null}

            {dash === "priority" ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Priority analytics">
                  <Donut data={data.priorities} colors={["#be123c", "#ea580c", "#0284c7", "#64748b"]} />
                </Card>
                <Card title="Priority volume">
                  <Bar data={data.priorities} />
                </Card>
              </div>
            ) : null}

            {dash === "departments" ? (
              <Card title="Department dashboard">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b text-xs uppercase text-slate-500">
                      <tr>
                        <th className="py-2">Department</th>
                        <th>Tickets</th>
                        <th>Open</th>
                        <th>Pending</th>
                        <th>Avg Res</th>
                        <th>CSAT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.departments.map((d) => (
                        <tr key={d.label} className="border-b border-slate-50">
                          <td className="py-2 capitalize font-medium">
                            {d.label}
                          </td>
                          <td>{d.value}</td>
                          <td>{d.open}</td>
                          <td>{d.pending}</td>
                          <td>{d.avgResolutionHrs}h</td>
                          <td>{d.csat || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : null}

            {dash === "ai" ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Kpi label="AI Replies Generated" value={data.ai.repliesGenerated} />
                <Kpi label="AI Tickets Resolved" value={data.ai.ticketsResolved} />
                <Kpi label="AI Suggested Articles" value={data.ai.suggestedArticles} />
                <Kpi label="AI Saved Hours" value={data.ai.savedHours} />
                <Kpi label="AI Accuracy" value={`${data.ai.accuracy}%`} />
                <Kpi label="AI Auto Assignment" value={data.ai.autoAssignment} />
                <Kpi
                  label="Categorization Accuracy"
                  value={`${data.ai.categorizationAccuracy}%`}
                />
              </div>
            ) : null}

            {dash === "knowledge" ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Kpi label="Total Articles" value={data.knowledge.totalArticles} />
                  <Kpi label="Helpful Votes" value={data.knowledge.helpfulVotes} />
                  <Kpi label="Failed Searches" value={data.knowledge.failedSearches} />
                </div>
                <Card title="Most viewed">
                  <ul className="space-y-2 text-sm">
                    {data.knowledge.mostViewed.map((a) => (
                      <li key={a.title} className="flex justify-between">
                        <span>{a.title}</span>
                        <span className="text-slate-500">
                          {a.views} views · {a.helpful} helpful
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
                <Card title="Failed search keywords">
                  <Bar data={data.knowledge.searchKeywords} />
                </Card>
              </div>
            ) : null}

            {dash === "automation" ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <Kpi label="Automation Rules" value={data.automation.rules} />
                <Kpi label="Successful" value={data.automation.successful} />
                <Kpi label="Failed" value={data.automation.failed} />
                <Kpi label="Tickets Automated" value={data.automation.ticketsAutomated} />
                <Kpi
                  label="Time Saved"
                  value={`${data.automation.timeSavedMin} min`}
                />
              </div>
            ) : null}

            {dash === "customers" ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Companies">
                  <ul className="space-y-2 text-sm">
                    {data.customers.companies.map((c) => (
                      <li key={c.id} className="flex justify-between">
                        <span>{c.name}</span>
                        <span className="text-slate-500">
                          {c.contacts} contacts
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
                <Card title="Open requests by customer">
                  <Bar data={data.customers.openByRequester} />
                </Card>
              </div>
            ) : null}

            {dash === "business" ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi label="Plan" value={data.business.plan} />
                <Kpi label="MRR" value={`$${data.business.mrr}`} />
                <Kpi label="ARR" value={`$${data.business.arr}`} />
                <Kpi label="Active Customers" value={data.business.activeCustomers} />
                <Kpi label="New Customers" value={data.business.newCustomers} />
                <Kpi label="Renewals" value={data.business.renewals} />
                <Kpi label="Churn Rate" value={`${data.business.churnRate}%`} />
                <Kpi
                  label="Seats"
                  value={`${data.business.seats}/${data.business.seatLimit}`}
                />
              </div>
            ) : null}

            {dash === "subscription" ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Kpi label="Total Tenants" value={data.subscription.totalTenants} />
                <Kpi label="Plan Variants" value={data.subscription.plans} />
                <Kpi label="Current Tenant Plan" value={data.business.plan} />
                <Kpi label="MRR" value={`$${data.business.mrr}`} />
                <Kpi label="Payment Success" value="98.2%" hint="Demo KPI" />
                <Kpi label="Trials" value="—" hint="Wire Stripe trials later" />
              </div>
            ) : null}

            {dash === "realtime" ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi
                  label="Incoming (1h)"
                  value={data.realtime.incomingLastHour}
                />
                <Kpi label="Queue Size" value={data.realtime.openQueue} />
                <Kpi label="Agents Online" value={data.realtime.agentsOnline} />
                <Kpi label="Near Breach" value={data.realtime.nearBreach} />
                <Kpi
                  label="Live Chat / Calls"
                  value={`${data.realtime.activeChats} / ${data.realtime.activeCalls}`}
                  hint="Channels not connected yet"
                />
              </div>
            ) : null}

            {dash === "geo" ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Tickets by country">
                  <Bar data={data.geographic} />
                </Card>
                <Card title="Geographic distribution">
                  <Donut data={data.geographic} colors={COLORS} />
                </Card>
              </div>
            ) : null}

            {dash === "custom" ? (
              <div className="space-y-4">
                <Card title="Custom dashboard builder">
                  <p className="mb-3 text-sm text-slate-500">
                    Toggle widgets. Layout is saved in this browser.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {WIDGET_CATALOG.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => toggleWidget(w.id)}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          widgets.includes(w.id)
                            ? "bg-sky-700 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {widgets.includes(w.id) ? "✓ " : "+ "}
                        {w.label}
                      </button>
                    ))}
                  </div>
                </Card>
                <div className="grid gap-4 lg:grid-cols-2">
                  {widgets.includes("kpi_tickets") ? (
                    <div className="grid grid-cols-3 gap-2 lg:col-span-2">
                      <Kpi label="Total" value={data.executive.totalTickets} />
                      <Kpi label="Open" value={data.executive.openTickets} />
                      <Kpi label="Closed today" value={data.executive.closedToday} />
                    </div>
                  ) : null}
                  {widgets.includes("sla_gauge") ? (
                    <Card title="SLA">
                      <Gauge value={data.sla.compliance} />
                    </Card>
                  ) : null}
                  {widgets.includes("csat_score") ? (
                    <Kpi label="CSAT" value={`${data.executive.csat} / 5`} />
                  ) : null}
                  {widgets.includes("agent_board") ? (
                    <Card title="Top agents">
                      <ul className="text-sm">
                        {data.agents.slice(0, 5).map((a) => (
                          <li key={a.id} className="flex justify-between py-1">
                            <span>{a.name}</span>
                            <span>{a.closed} closed</span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  ) : null}
                  {widgets.includes("ai_usage") ? (
                    <Kpi label="AI replies" value={data.ai.repliesGenerated} />
                  ) : null}
                  {widgets.includes("ticket_queue") ? (
                    <Kpi label="Queue" value={data.realtime.openQueue} />
                  ) : null}
                  {widgets.includes("trend") ? (
                    <Card title="Trend">
                      <Bar
                        data={data.dailyTrend.map((d) => ({
                          label: d.label,
                          value: d.created,
                        }))}
                      />
                    </Card>
                  ) : null}
                  {widgets.includes("channels") ? (
                    <Card title="Channels">
                      <Donut data={data.channels} colors={COLORS} />
                    </Card>
                  ) : null}
                  {widgets.includes("automation") ? (
                    <Kpi
                      label="Automations run"
                      value={data.automation.successful}
                    />
                  ) : null}
                  {widgets.includes("knowledge") ? (
                    <Kpi
                      label="KB views (top)"
                      value={data.knowledge.mostViewed[0]?.views ?? 0}
                    />
                  ) : null}
                  {widgets.includes("geo") ? (
                    <Card title="Geo">
                      <Bar data={data.geographic.slice(0, 6)} />
                    </Card>
                  ) : null}
                  {widgets.includes("revenue") ? (
                    <Kpi label="MRR" value={`$${data.business.mrr}`} />
                  ) : null}
                </div>
              </div>
            ) : null}

            {dash === "reports" ? (
              <Card title="Export & scheduled reports">
                <p className="text-sm text-slate-600">
                  Generate reports now. Email scheduling can be wired to a cron
                  later (`CRON_SECRET`).
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={exportCsv}
                    className="rounded-lg bg-sky-700 px-4 py-2 text-sm text-white"
                  >
                    Download CSV / Excel-ready
                  </button>
                  <button
                    type="button"
                    onClick={printPdf}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                  >
                    Print / Save PDF
                  </button>
                  <a
                    href="/api/tickets/export"
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                  >
                    Full tickets CSV
                  </a>
                </div>
                <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-500">
                  <li>Daily / Weekly / Monthly schedule — configure via cron hitting analytics export</li>
                  <li>Filters above apply to dashboard metrics and CSV summary</li>
                  <li>Drill into Inbox Kanban for ticket-level detail</li>
                </ul>
              </Card>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
