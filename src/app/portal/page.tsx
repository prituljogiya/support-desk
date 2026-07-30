import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PriorityBadge, StatusBadge } from "@/components/shell";
import {
  PORTAL_STATUS_TABS,
  portalTicketListWhere,
} from "@/lib/portal-access";
import type { TicketStatus } from "@prisma/client";

type Props = { searchParams: Promise<{ status?: string }> };

export default async function PortalHomePage({ searchParams }: Props) {
  const session = await auth();
  const sp = await searchParams;
  const statusParam = sp.status;
  const status =
    statusParam &&
    PORTAL_STATUS_TABS.some((t) => t.key === statusParam)
      ? (statusParam as TicketStatus | "all")
      : "all";

  const tickets = await prisma.ticket.findMany({
    where: portalTicketListWhere(
      session!.user.organizationId!,
      session!.user.id,
      session!.user.email!,
      session!.user.membershipRole!,
      status,
    ),
    orderBy: { updatedAt: "desc" },
    include: {
      requester: { select: { id: true, name: true, email: true } },
    },
  });

  const showRequester =
    session!.user.membershipRole === "customer_manager";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-sky-950">
            My tickets
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Track status, browse the help center, or open a new request.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/portal/knowledge"
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Help center
          </Link>
          <Link
            href="/portal/tickets/new"
            className="rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
          >
            New ticket
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {PORTAL_STATUS_TABS.map((tab) => {
          const active = status === tab.key;
          const href =
            tab.key === "all" ? "/portal" : `/portal?status=${tab.key}`;
          return (
            <Link
              key={tab.key}
              href={href}
              className={`rounded-full px-3 py-1 text-sm ${
                active
                  ? "bg-sky-800 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {tickets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white/70 px-6 py-12 text-center">
          <p className="text-sm text-zinc-600">
            No tickets in this view. Try the help center before opening a new
            request — many answers are already published.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              href="/portal/knowledge"
              className="text-sm font-medium text-sky-800 hover:underline"
            >
              Browse help center
            </Link>
            <Link
              href="/portal/tickets/new"
              className="text-sm font-medium text-sky-800 hover:underline"
            >
              Create a ticket
            </Link>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link
                href={`/portal/tickets/${t.id}`}
                className="flex flex-col gap-2 px-4 py-3 hover:bg-sky-50/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-medium text-zinc-900">{t.subject}</div>
                  <div className="text-xs text-zinc-500">
                    Updated {t.updatedAt.toLocaleString()}
                    {showRequester && t.requester
                      ? ` · ${t.requester.name || t.requester.email}`
                      : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={t.status} />
                  <PriorityBadge priority={t.priority} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
