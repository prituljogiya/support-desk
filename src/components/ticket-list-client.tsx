"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TicketPriority, TicketStatus } from "@prisma/client";
import {
  PriorityBadge,
  StatusBadge,
  SyncBadge,
  SlaBadge,
} from "@/components/shell";
import { STATUSES, PRIORITIES } from "@/lib/tickets";

type Ticket = {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  syncStatus: string;
  syncError?: string | null;
  firstResponseDueAt?: string | null;
  resolutionDueAt?: string | null;
  requester: { name: string };
  assignee?: { name: string } | null;
  tags: { tagId: string; tag: { name: string; color: string } }[];
};

export function TicketListClient({
  tickets,
  agents,
  tags,
  currentFilters,
}: {
  tickets: Ticket[];
  agents: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  currentFilters: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [tagId, setTagId] = useState("");
  const [viewName, setViewName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const allSelected =
    tickets.length > 0 && selected.length === tickets.length;

  function toggle(id: string) {
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  }

  async function bulkApply() {
    if (!selected.length) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/tickets/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketIds: selected,
        ...(status ? { status } : {}),
        ...(priority ? { priority } : {}),
        ...(assigneeId
          ? { assigneeId: assigneeId === "unassigned" ? null : assigneeId }
          : {}),
        ...(tagId ? { addTagIds: [tagId] } : {}),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "Bulk update failed");
      return;
    }
    setMessage(`Updated ${data.updated} tickets`);
    setSelected([]);
    router.refresh();
  }

  async function saveView() {
    if (!viewName.trim()) return;
    setBusy(true);
    const filters: Record<string, string> = {};
    for (const [k, v] of Object.entries(currentFilters)) {
      if (v) filters[k] = v;
    }
    const res = await fetch("/api/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: viewName.trim(),
        filters,
        isShared: true,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "Could not save view");
      return;
    }
    setMessage(`Saved view “${viewName}”`);
    setViewName("");
    router.refresh();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) =>
                setSelected(e.target.checked ? tickets.map((t) => t.id) : [])
              }
            />
            Select all ({selected.length})
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded border border-slate-200 px-2 py-1"
          >
            <option value="">Set status…</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="rounded border border-slate-200 px-2 py-1"
          >
            <option value="">Set priority…</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="rounded border border-slate-200 px-2 py-1"
          >
            <option value="">Assign…</option>
            <option value="unassigned">Unassigned</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select
            value={tagId}
            onChange={(e) => setTagId(e.target.value)}
            className="rounded border border-slate-200 px-2 py-1"
          >
            <option value="">Add tag…</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !selected.length}
            onClick={() => void bulkApply()}
            className="rounded bg-sky-700 px-3 py-1 text-white disabled:opacity-50"
          >
            Apply bulk
          </button>
          <a
            href="/api/tickets/export"
            className="rounded border border-slate-200 bg-white px-3 py-1 hover:bg-slate-50"
          >
            Export CSV
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <input
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            placeholder="Save current filters as view…"
            className="min-w-[220px] flex-1 rounded border border-slate-200 px-2 py-1"
          />
          <button
            type="button"
            disabled={busy || !viewName.trim()}
            onClick={() => void saveView()}
            className="rounded border border-slate-200 bg-white px-3 py-1 hover:bg-slate-50 disabled:opacity-50"
          >
            Save view
          </button>
          {message ? (
            <span className="text-xs text-slate-600">{message}</span>
          ) : null}
        </div>
      </div>

      <ul className="divide-y divide-slate-100 overflow-auto bg-white">
        {tickets.length === 0 ? (
          <li className="px-4 py-12 text-center text-sm text-slate-500">
            No tickets match these filters.
          </li>
        ) : (
          tickets.map((t) => (
            <li key={t.id} className="flex items-start gap-3 px-4 py-3 hover:bg-sky-50/40">
              <input
                type="checkbox"
                checked={selected.includes(t.id)}
                onChange={() => toggle(t.id)}
                className="mt-1"
              />
              <Link
                href={`/desk/tickets/${t.id}`}
                className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-900">
                    {t.subject}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>
                      {t.requester.name} ·{" "}
                      {t.assignee
                        ? `Assigned to ${t.assignee.name}`
                        : "Unassigned"}
                    </span>
                    {t.tags.map((tt) => (
                      <span
                        key={tt.tagId}
                        className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                        style={{ background: tt.tag.color }}
                      >
                        {tt.tag.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={t.status} />
                  <PriorityBadge priority={t.priority} />
                  <SlaBadge dueAt={t.firstResponseDueAt} label="FR" />
                  <SlaBadge dueAt={t.resolutionDueAt} label="Res" />
                  <SyncBadge
                    syncStatus={t.syncStatus}
                    syncError={t.syncError}
                  />
                </div>
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
