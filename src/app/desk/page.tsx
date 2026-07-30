import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TicketKanban } from "@/components/ticket-kanban";
import { TicketListClient } from "@/components/ticket-list-client";
import { PRIORITIES } from "@/lib/tickets";
import { ASSIGNABLE_ROLES } from "@/lib/permissions";

type Props = {
  searchParams: Promise<{
    status?: string;
    priority?: string;
    assigneeId?: string;
    tagId?: string;
    q?: string;
    view?: string;
    layout?: string;
  }>;
};

export default async function DeskInboxPage({ searchParams }: Props) {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  const params = await searchParams;

  let viewFilters: Record<string, string> = {};
  if (params.view) {
    const view = await prisma.savedView.findFirst({
      where: { id: params.view, organizationId: orgId },
    });
    if (view) {
      try {
        viewFilters = JSON.parse(view.filters) as Record<string, string>;
      } catch {
        viewFilters = {};
      }
    }
  }

  // Kanban shows all statuses as columns — ignore status filter unless list layout
  const layout = params.layout === "list" ? "list" : "kanban";
  const status =
    layout === "list" ? params.status || viewFilters.status : undefined;
  const priority = params.priority || viewFilters.priority;
  const assigneeId = params.assigneeId || viewFilters.assigneeId;
  const tagId = params.tagId || viewFilters.tagId;
  const q = params.q;

  const [tickets, agents, tags, views, counts] = await Promise.all([
    prisma.ticket.findMany({
      where: {
        organizationId: orgId,
        ...(status ? { status: status as never } : {}),
        ...(priority ? { priority: priority as never } : {}),
        ...(assigneeId === "unassigned"
          ? { assigneeId: null }
          : assigneeId
            ? { assigneeId }
            : {}),
        ...(tagId ? { tags: { some: { tagId } } } : {}),
        ...(q
          ? {
              OR: [
                { subject: { contains: q } },
                { description: { contains: q } },
              ],
            }
          : {}),
      },
      include: {
        requester: { select: { name: true, email: true } },
        assignee: { select: { name: true } },
        tags: { include: { tag: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.membership.findMany({
      where: {
        organizationId: orgId,
        role: { in: ASSIGNABLE_ROLES },
      },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.tag.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
    }),
    prisma.savedView.findMany({
      where: {
        organizationId: orgId,
        OR: [{ isShared: true }, { userId: session!.user.id }],
      },
      orderBy: { name: "asc" },
    }),
    Promise.all([
      prisma.ticket.count({ where: { organizationId: orgId, status: "open" } }),
      prisma.ticket.count({
        where: { organizationId: orgId, status: "pending" },
      }),
      prisma.ticket.count({
        where: { organizationId: orgId, status: "resolved" },
      }),
      prisma.ticket.count({
        where: { organizationId: orgId, status: "closed" },
      }),
    ]),
  ]);

  const [open, pending, resolved, closed] = counts;

  function hrefWith(extra: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    const merged = {
      layout: layout === "list" ? "list" : undefined,
      view: params.view,
      priority,
      assigneeId,
      tagId,
      q,
      ...extra,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v) sp.set(k, v);
    }
    const qs = sp.toString();
    return qs ? `/desk?${qs}` : "/desk";
  }

  return (
    <div className="flex h-full min-h-[calc(100vh-3rem)]">
      <div className="hidden w-52 shrink-0 border-r border-slate-200 bg-white p-3 lg:block">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Views
        </div>
        <ul className="space-y-1">
          <li>
            <Link
              href={hrefWith({ view: undefined })}
              className={`block rounded px-2 py-1.5 text-sm ${
                !params.view
                  ? "bg-sky-50 text-sky-800"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              All tickets
            </Link>
          </li>
          {views.map((v) => (
            <li key={v.id}>
              <Link
                href={hrefWith({ view: v.id })}
                className={`block rounded px-2 py-1.5 text-sm ${
                  params.view === v.id
                    ? "bg-sky-50 text-sky-800"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {v.name}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Board
        </div>
        <div className="space-y-1 text-sm text-slate-600">
          {[
            ["Open", open],
            ["Pending", pending],
            ["Resolved", resolved],
            ["Closed", closed],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex justify-between px-2">
              <span>{label}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">
                {layout === "kanban" ? "Kanban board" : "Inbox list"}
              </h1>
              <p className="text-xs text-slate-500">
                {layout === "kanban"
                  ? "Drag cards between columns to change status"
                  : "Classic list view"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/api/tickets/export"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Export CSV
              </a>
              <div className="flex rounded-lg border border-slate-200 p-0.5 text-sm">
              <Link
                href={hrefWith({ layout: undefined })}
                className={`rounded-md px-3 py-1.5 ${
                  layout === "kanban"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                Kanban
              </Link>
              <Link
                href={hrefWith({ layout: "list" })}
                className={`rounded-md px-3 py-1.5 ${
                  layout === "list"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                List
              </Link>
              </div>
            </div>
          </div>

          <form className="mt-3 flex flex-wrap gap-2">
            {layout === "list" ? (
              <input type="hidden" name="layout" value="list" />
            ) : null}
            {params.view ? (
              <input type="hidden" name="view" value={params.view} />
            ) : null}
            <select
              name="priority"
              defaultValue={priority ?? ""}
              className="rounded border border-slate-200 px-2 py-1.5 text-sm"
            >
              <option value="">All priorities</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              name="assigneeId"
              defaultValue={assigneeId ?? ""}
              className="rounded border border-slate-200 px-2 py-1.5 text-sm"
            >
              <option value="">All assignees</option>
              <option value="unassigned">Unassigned</option>
              {agents.map((a) => (
                <option key={a.user.id} value={a.user.id}>
                  {a.user.name}
                </option>
              ))}
            </select>
            <select
              name="tagId"
              defaultValue={tagId ?? ""}
              className="rounded border border-slate-200 px-2 py-1.5 text-sm"
            >
              <option value="">All tags</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800"
            >
              Filter
            </button>
            <Link
              href={layout === "list" ? "/desk?layout=list" : "/desk"}
              className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Clear
            </Link>
          </form>
        </div>

        {layout === "kanban" ? (
          <TicketKanban
            tickets={tickets.map((t) => ({
              id: t.id,
              subject: t.subject,
              status: t.status,
              priority: t.priority,
              syncStatus: t.syncStatus,
              firstResponseDueAt: t.firstResponseDueAt?.toISOString() ?? null,
              resolutionDueAt: t.resolutionDueAt?.toISOString() ?? null,
              updatedAt: t.updatedAt.toISOString(),
              requester: t.requester,
              assignee: t.assignee,
              tags: t.tags,
            }))}
          />
        ) : (
          <TicketListClient
            agents={agents.map((a) => ({ id: a.user.id, name: a.user.name }))}
            tags={tags.map((t) => ({ id: t.id, name: t.name }))}
            currentFilters={{
              priority,
              assigneeId,
              tagId,
              q,
              view: params.view,
            }}
            tickets={tickets.map((t) => ({
              id: t.id,
              subject: t.subject,
              status: t.status,
              priority: t.priority,
              syncStatus: t.syncStatus,
              syncError: t.syncError,
              firstResponseDueAt: t.firstResponseDueAt?.toISOString() ?? null,
              resolutionDueAt: t.resolutionDueAt?.toISOString() ?? null,
              requester: t.requester,
              assignee: t.assignee,
              tags: t.tags,
            }))}
          />
        )}
      </div>
    </div>
  );
}
