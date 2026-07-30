"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TicketPriority, TicketStatus } from "@prisma/client";
import { PriorityBadge, SlaBadge, ChannelBadge } from "@/components/shell";
import { STATUSES, statusLabel } from "@/lib/tickets";

export type KanbanTicket = {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  channel?: string;
  syncStatus: string;
  firstResponseDueAt?: string | null;
  resolutionDueAt?: string | null;
  updatedAt: string;
  requester: { name: string; email: string };
  assignee?: { name: string } | null;
  tags: { tagId: string; tag: { name: string; color: string } }[];
};

const COLUMN_META: Record<
  TicketStatus,
  { accent: string; header: string; drop: string }
> = {
  open: {
    accent: "border-t-sky-500",
    header: "bg-sky-50 text-sky-900",
    drop: "bg-sky-50/80 ring-sky-300",
  },
  pending: {
    accent: "border-t-amber-500",
    header: "bg-amber-50 text-amber-900",
    drop: "bg-amber-50/80 ring-amber-300",
  },
  resolved: {
    accent: "border-t-emerald-500",
    header: "bg-emerald-50 text-emerald-900",
    drop: "bg-emerald-50/80 ring-emerald-300",
  },
  closed: {
    accent: "border-t-slate-400",
    header: "bg-slate-100 text-slate-800",
    drop: "bg-slate-100/80 ring-slate-300",
  },
};

export function TicketKanban({ tickets: initial }: { tickets: KanbanTicket[] }) {
  const router = useRouter();
  const [tickets, setTickets] = useState(initial);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<TicketStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setTickets(initial);
  }, [initial]);

  const columns = useMemo(() => {
    const map: Record<TicketStatus, KanbanTicket[]> = {
      open: [],
      pending: [],
      resolved: [],
      closed: [],
    };
    for (const t of tickets) {
      map[t.status]?.push(t);
    }
    return map;
  }, [tickets]);

  async function moveTicket(ticketId: string, status: TicketStatus) {
    const prev = tickets;
    const current = prev.find((t) => t.id === ticketId);
    if (!current || current.status === status) return;

    setTickets((list) =>
      list.map((t) => (t.id === ticketId ? { ...t, status } : t)),
    );
    setError(null);

    const res = await fetch(`/api/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setTickets(prev);
      setError(data.error || "Could not update ticket");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {error ? (
        <p className="mx-4 mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-4">
        {STATUSES.map((status) => {
          const meta = COLUMN_META[status];
          const items = columns[status];
          const isOver = overStatus === status && draggingId;

          return (
            <section
              key={status}
              className={`flex w-[280px] shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-50/80 shadow-sm border-t-4 ${meta.accent} ${
                isOver ? `ring-2 ${meta.drop}` : ""
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setOverStatus(status);
              }}
              onDragLeave={() => {
                setOverStatus((s) => (s === status ? null : s));
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id =
                  e.dataTransfer.getData("text/ticket-id") || draggingId;
                setOverStatus(null);
                setDraggingId(null);
                if (id) void moveTicket(id, status);
              }}
            >
              <header
                className={`flex items-center justify-between rounded-t-[10px] px-3 py-2.5 ${meta.header}`}
              >
                <h2 className="text-sm font-semibold">{statusLabel(status)}</h2>
                <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold tabular-nums">
                  {items.length}
                </span>
              </header>

              <div className="flex min-h-[320px] flex-1 flex-col gap-2 overflow-y-auto p-2">
                {items.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 px-3 py-8 text-center text-xs text-slate-400">
                    Drop tickets here
                  </div>
                ) : (
                  items.map((t) => (
                    <article
                      key={t.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggingId(t.id);
                        e.dataTransfer.setData("text/ticket-id", t.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setOverStatus(null);
                      }}
                      className={`group rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-sky-300 hover:shadow-md ${
                        draggingId === t.id ? "opacity-50" : ""
                      } ${pending ? "pointer-events-none" : ""}`}
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <Link
                          href={`/desk/tickets/${t.id}`}
                          className="line-clamp-2 text-sm font-medium text-slate-900 hover:text-sky-800"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t.subject}
                        </Link>
                        <span className="cursor-grab text-slate-300 group-hover:text-slate-500 active:cursor-grabbing">
                          ⋮⋮
                        </span>
                      </div>

                      <div className="mb-2 flex flex-wrap gap-1">
                        <ChannelBadge channel={t.channel} />
                        <PriorityBadge priority={t.priority} />
                        <SlaBadge dueAt={t.firstResponseDueAt} label="FR" />
                        <SlaBadge dueAt={t.resolutionDueAt} label="Res" />
                      </div>

                      {t.tags.length > 0 ? (
                        <div className="mb-2 flex flex-wrap gap-1">
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
                      ) : null}

                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span className="truncate">{t.requester.name}</span>
                        <span className="truncate">
                          {t.assignee?.name ?? "Unassigned"}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1">
                        {STATUSES.filter((s) => s !== t.status).map((s) => (
                          <button
                            key={s}
                            type="button"
                            title={`Move to ${s}`}
                            onClick={() => void moveTicket(t.id, s)}
                            className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] capitalize text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                          >
                            → {s}
                          </button>
                        ))}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
