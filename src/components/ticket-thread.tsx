"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PriorityBadge,
  StatusBadge,
  SyncBadge,
  SlaBadge,
  ChannelBadge,
} from "@/components/shell";
import { PRIORITIES, STATUSES } from "@/lib/tickets";
import { TicketExtras } from "@/components/ticket-extras";

type Person = { id: string; name: string; email: string; role?: string };
type Tag = { id: string; name: string; color: string };
type Message = {
  id: string;
  body: string;
  isInternal: boolean;
  syncStatus: string;
  syncError?: string | null;
  createdAt: string;
  author: { id: string; name: string; role?: string };
};

type Ticket = {
  id: string;
  subject: string;
  description: string;
  status: "open" | "pending" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  channel?: string;
  syncStatus: string;
  syncError?: string | null;
  freshdeskId?: number | null;
  firstResponseDueAt?: string | null;
  resolutionDueAt?: string | null;
  requester: Person;
  assignee?: Person | null;
  contact?: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    company?: { id: string; name: string } | null;
  } | null;
  tags?: { tag: Tag }[];
  messages: Message[];
};

type Canned = { id: string; title: string; body: string; score?: number };
type Macro = { id: string; name: string; description?: string | null };

export function TicketThread({
  ticket: initial,
  mode,
  agents = [],
  allTags = [],
  macrosEnabled = false,
  aiEnabled = false,
}: {
  ticket: Ticket;
  mode: "portal" | "desk";
  agents?: Person[];
  allTags?: Tag[];
  macrosEnabled?: boolean;
  aiEnabled?: boolean;
}) {
  const router = useRouter();
  const [ticket, setTicket] = useState(initial);
  const [body, setBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [canned, setCanned] = useState<Canned[]>([]);
  const [suggestions, setSuggestions] = useState<Canned[]>([]);
  const [macros, setMacros] = useState<Macro[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "desk") return;
    fetch(
      `/api/canned?suggestFor=1&subject=${encodeURIComponent(ticket.subject)}&description=${encodeURIComponent(ticket.description)}`,
    )
      .then((r) => r.json())
      .then((data) => {
        setCanned(data.canned ?? []);
        setSuggestions(data.suggestions ?? []);
      })
      .catch(() => {});
    if (macrosEnabled) {
      fetch("/api/macros")
        .then((r) => r.json())
        .then((data) => setMacros(data.macros ?? []))
        .catch(() => {});
    }
  }, [mode, macrosEnabled, ticket.subject, ticket.description]);

  async function refresh() {
    const res = await fetch(`/api/tickets/${ticket.id}`);
    const data = await res.json();
    if (res.ok) {
      setTicket({
        ...data.ticket,
        messages: data.ticket.messages.map(
          (m: Message & { createdAt: string | Date }) => ({
            ...m,
            createdAt:
              typeof m.createdAt === "string"
                ? m.createdAt
                : new Date(m.createdAt).toISOString(),
          }),
        ),
        firstResponseDueAt: data.ticket.firstResponseDueAt
          ? new Date(data.ticket.firstResponseDueAt).toISOString()
          : null,
        resolutionDueAt: data.ticket.resolutionDueAt
          ? new Date(data.ticket.resolutionDueAt).toISOString()
          : null,
      });
    }
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/tickets/${ticket.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, isInternal: mode === "desk" && isInternal }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Failed to send");
      return;
    }
    setBody("");
    setIsInternal(false);
    await refresh();
    router.refresh();
  }

  async function updateMeta(patch: Record<string, unknown>) {
    setSavingMeta(true);
    setError(null);
    const res = await fetch(`/api/tickets/${ticket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    setSavingMeta(false);
    if (!res.ok) {
      setError(data.error || "Update failed");
      return;
    }
    await refresh();
    router.refresh();
  }

  async function applyMacro(macroId: string) {
    setSavingMeta(true);
    setError(null);
    const res = await fetch(`/api/tickets/${ticket.id}/macros`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ macroId }),
    });
    const data = await res.json();
    setSavingMeta(false);
    if (!res.ok) {
      setError(data.error || "Macro failed");
      return;
    }
    await refresh();
    router.refresh();
  }

  async function aiSuggestReply() {
    setAiBusy(true);
    setError(null);
    const res = await fetch("/api/ai/suggest-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: ticket.id }),
    });
    const data = await res.json();
    setAiBusy(false);
    if (!res.ok) {
      setError(data.error || "AI suggest failed");
      return;
    }
    setBody(data.reply || "");
  }

  async function aiSummarize() {
    setAiBusy(true);
    setError(null);
    const res = await fetch("/api/ai/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: ticket.id }),
    });
    const data = await res.json();
    setAiBusy(false);
    if (!res.ok) {
      setError(data.error || "AI summarize failed");
      return;
    }
    setAiSummary(data.summary || null);
  }

  function insertCanned(text: string) {
    const personalized = text.replace(/\{\{name\}\}/g, ticket.requester.name);
    setBody((prev) => (prev ? `${prev}\n\n${personalized}` : personalized));
  }

  const selectedTagIds = (ticket.tags ?? []).map((t) => t.tag.id);

  return (
    <div
      className={
        mode === "desk"
          ? "grid min-h-[calc(100vh-3rem)] lg:grid-cols-[1fr_300px]"
          : "grid gap-6 lg:grid-cols-[1fr_280px]"
      }
    >
      <div
        className={
          mode === "desk"
            ? "space-y-4 border-r border-slate-200 bg-white p-4"
            : "space-y-6"
        }
      >
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <ChannelBadge channel={ticket.channel} />
            {mode === "desk" ? (
              <>
                <SlaBadge dueAt={ticket.firstResponseDueAt} label="FR" />
                <SlaBadge dueAt={ticket.resolutionDueAt} label="Res" />
              </>
            ) : null}
            <SyncBadge
              syncStatus={ticket.syncStatus}
              syncError={ticket.syncError}
            />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            {ticket.subject}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            From {ticket.requester.name} ({ticket.requester.email})
            {ticket.channel === "whatsapp"
              ? " · Replies send on WhatsApp"
              : ""}
            {ticket.freshdeskId ? ` · FD #${ticket.freshdeskId}` : ""}
          </p>
        </div>

        <div className="space-y-3">
          {ticket.messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-lg border px-4 py-3 ${
                m.isInternal
                  ? "border-amber-200 bg-amber-50/70"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  <strong className="text-slate-800">{m.author.name}</strong>
                  {m.isInternal ? " · internal note" : ""}
                </span>
                <span className="flex items-center gap-2">
                  <SyncBadge syncStatus={m.syncStatus} syncError={m.syncError} />
                  {new Date(m.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-800">
                {m.body}
              </p>
            </div>
          ))}
        </div>

        <TicketExtras ticketId={ticket.id} status={ticket.status} mode={mode} />

        <form
          onSubmit={sendReply}
          className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
        >
          {error ? (
            <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          {mode === "desk" && aiEnabled ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={aiBusy}
                onClick={() => void aiSuggestReply()}
                className="rounded-full bg-violet-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-800 disabled:opacity-50"
              >
                {aiBusy ? "AI working…" : "AI draft reply"}
              </button>
              <button
                type="button"
                disabled={aiBusy}
                onClick={() => void aiSummarize()}
                className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-50"
              >
                Summarize
              </button>
              <span className="text-[11px] text-slate-400">
                Uses your platform LLM (OpenAI-compatible)
              </span>
            </div>
          ) : null}

          {aiSummary ? (
            <div className="rounded-lg border border-violet-100 bg-violet-50/80 px-3 py-2 text-xs text-violet-950 whitespace-pre-wrap">
              <div className="mb-1 font-semibold">AI summary</div>
              {aiSummary}
            </div>
          ) : null}

          {mode === "desk" && (suggestions.length > 0 || canned.length > 0) ? (
            <div className="space-y-2">
              {suggestions.length > 0 ? (
                <div>
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                    Suggested replies
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => insertCanned(s.body)}
                        className="rounded border border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-800 hover:bg-sky-100"
                      >
                        {s.title}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                  Canned responses
                </div>
                <select
                  className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
                  defaultValue=""
                  onChange={(e) => {
                    const item = canned.find((c) => c.id === e.target.value);
                    if (item) insertCanned(item.body);
                    e.target.value = "";
                  }}
                >
                  <option value="">Insert canned response…</option>
                  {canned.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}

          <textarea
            required
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              mode === "desk"
                ? "Write a public reply or internal note…"
                : "Add a reply…"
            }
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
          />
          {mode === "desk" ? (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
              />
              Internal note (not visible to customer)
            </label>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60"
          >
            {loading ? "Sending…" : isInternal ? "Add note" : "Send reply"}
          </button>
        </form>
      </div>

      {mode === "desk" ? (
        <aside className="space-y-5 bg-slate-50 p-4">
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Properties
            </h2>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-slate-500">Status</span>
                <select
                  disabled={savingMeta}
                  value={ticket.status}
                  onChange={(e) => updateMeta({ status: e.target.value })}
                  className="w-full rounded border border-slate-200 bg-white px-2 py-1.5"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-500">Priority</span>
                <select
                  disabled={savingMeta}
                  value={ticket.priority}
                  onChange={(e) => updateMeta({ priority: e.target.value })}
                  className="w-full rounded border border-slate-200 bg-white px-2 py-1.5"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-500">Assignee</span>
                <select
                  disabled={savingMeta}
                  value={ticket.assignee?.id ?? ""}
                  onChange={(e) =>
                    updateMeta({ assigneeId: e.target.value || null })
                  }
                  className="w-full rounded border border-slate-200 bg-white px-2 py-1.5"
                >
                  <option value="">Unassigned</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              {allTags.length ? (
                <div className="text-sm">
                  <span className="mb-1 block text-slate-500">Tags</span>
                  <div className="flex flex-wrap gap-1.5">
                    {allTags.map((tag) => {
                      const on = selectedTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          disabled={savingMeta}
                          onClick={() => {
                            const next = on
                              ? selectedTagIds.filter((id) => id !== tag.id)
                              : [...selectedTagIds, tag.id];
                            updateMeta({ tagIds: next });
                          }}
                          className={`rounded px-2 py-0.5 text-xs font-medium ${
                            on
                              ? "text-white"
                              : "border border-slate-200 bg-white text-slate-600"
                          }`}
                          style={on ? { background: tag.color } : undefined}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {ticket.contact ? (
            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Contact
              </h2>
              <div className="rounded border border-slate-200 bg-white p-3 text-sm">
                <div className="font-medium text-slate-900">
                  {ticket.contact.name}
                </div>
                <div className="text-slate-500">{ticket.contact.email}</div>
                {ticket.contact.phone ? (
                  <div className="text-slate-500">{ticket.contact.phone}</div>
                ) : null}
                {ticket.contact.company ? (
                  <div className="mt-1 text-xs text-slate-400">
                    {ticket.contact.company.name}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {macrosEnabled && macros.length > 0 ? (
            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Macros
              </h2>
              <div className="space-y-1.5">
                {macros.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    disabled={savingMeta}
                    onClick={() => applyMacro(m.id)}
                    className="block w-full rounded border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:bg-sky-50 disabled:opacity-60"
                  >
                    <div className="font-medium text-slate-800">{m.name}</div>
                    {m.description ? (
                      <div className="text-xs text-slate-500">
                        {m.description}
                      </div>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}
