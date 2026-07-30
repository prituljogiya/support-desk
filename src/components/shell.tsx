"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { OrgSwitcher } from "@/components/org-switcher";
import { NotificationBell } from "@/components/notification-bell";
import { LiveBadge, LiveSyncProvider } from "@/components/live-sync";
import {
  priorityBadgeClass,
  priorityLabel,
  statusBadgeClass,
  statusLabel,
  syncBadgeClass,
} from "@/lib/tickets";
import type { MembershipRole, TicketPriority, TicketStatus } from "@prisma/client";
import { slaChip } from "@/lib/sla-ui";
import {
  hasPermission,
  ROLE_LABELS,
  type Permission,
} from "@/lib/permissions";

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span
      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClass(status)}`}
    >
      {statusLabel(status)}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <span
      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${priorityBadgeClass(priority)}`}
    >
      {priorityLabel(priority)}
    </span>
  );
}

export function SyncBadge({
  syncStatus,
  syncError,
}: {
  syncStatus: string;
  syncError?: string | null;
}) {
  return (
    <span
      title={syncError ?? undefined}
      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${syncBadgeClass(syncStatus)}`}
    >
      sync: {syncStatus}
    </span>
  );
}

export function ChannelBadge({ channel }: { channel?: string | null }) {
  if (!channel) return null;
  const colors: Record<string, string> = {
    portal: "bg-sky-50 text-sky-800",
    email: "bg-indigo-50 text-indigo-800",
    whatsapp: "bg-emerald-50 text-emerald-800",
    chat: "bg-violet-50 text-violet-800",
    api: "bg-slate-100 text-slate-700",
  };
  return (
    <span
      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium capitalize ${
        colors[channel] || "bg-slate-100 text-slate-700"
      }`}
    >
      {channel}
    </span>
  );
}

export function SlaBadge({
  dueAt,
  label,
}: {
  dueAt?: Date | string | null;
  label: string;
}) {
  const chip = slaChip(dueAt);
  if (!chip) return null;
  const cls =
    chip.state === "breached"
      ? "bg-rose-100 text-rose-800"
      : chip.state === "urgent"
        ? "bg-amber-100 text-amber-900"
        : "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label} {chip.label}
    </span>
  );
}

const deskNav: {
  href: string;
  label: string;
  icon: string;
  permission?: Permission;
}[] = [
  { href: "/desk", label: "Inbox", icon: "◉", permission: "desk.access" },
  {
    href: "/desk/contacts",
    label: "Contacts",
    icon: "◎",
    permission: "tickets.view",
  },
  {
    href: "/desk/knowledge",
    label: "Knowledge",
    icon: "◌",
    permission: "knowledge.view",
  },
  {
    href: "/desk/analytics",
    label: "Analytics",
    icon: "▦",
    permission: "reports.view",
  },
  {
    href: "/desk/admin",
    label: "Tenant Admin",
    icon: "⚙",
    permission: "settings.manage",
  },
];

export function DeskShell({
  orgName,
  children,
}: {
  orgName?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data } = useSession();
  const role = data?.user?.membershipRole as MembershipRole | null | undefined;
  const visibleNav = deskNav.filter(
    (item) =>
      !item.permission ||
      hasPermission(role, item.permission, {
        isSuperAdmin: data?.user?.isSuperAdmin,
      }),
  );

  // Tenant Admin app has its own full sidebar chrome
  if (pathname === "/desk/admin" || pathname === "/desk/admin/") {
    return <div className="min-h-full">{children}</div>;
  }

  return (
    <LiveSyncProvider>
    <div className="flex min-h-full bg-slate-100 text-slate-900">
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-slate-200 bg-slate-900 text-slate-100">
        <div className="border-b border-slate-700/80 px-4 py-4">
          <Link href="/desk" className="block">
            <div className="text-lg font-semibold tracking-tight text-white">
              Support Desk
            </div>
            <div className="truncate text-xs text-sky-300/90">
              {orgName || "Agent workspace"}
            </div>
          </Link>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {visibleNav.map((item) => {
            const active =
              item.href === "/desk"
                ? pathname === "/desk" || pathname.startsWith("/desk/tickets")
                : item.href === "/desk/analytics"
                  ? pathname.startsWith("/desk/analytics") ||
                    pathname.startsWith("/desk/reports")
                  : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                  active
                    ? "bg-sky-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span className="w-4 text-center text-xs opacity-80">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-700/80 p-3 text-xs text-slate-400">
          {data?.user?.name}
          <div className="text-slate-500">
            {role ? ROLE_LABELS[role] || role : "—"}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4">
          <div className="flex min-w-0 items-center gap-3">
            <OrgSwitcher />
            <form action="/desk" className="hidden md:block">
              <input
                name="q"
                placeholder="Search tickets…"
                className="w-64 rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-sky-500 focus:bg-white"
              />
            </form>
          </div>
          <div className="flex items-center gap-2">
            <LiveBadge />
            <NotificationBell />
            {data?.user?.isSuperAdmin ? (
              <Link
                href="/platform"
                className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
              >
                Platform
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
    </LiveSyncProvider>
  );
}

export function PortalShell({
  brandName,
  brandColor,
  logoUrl,
  whiteLabel,
  children,
}: {
  brandName: string;
  brandColor?: string | null;
  logoUrl?: string | null;
  whiteLabel?: boolean;
  children: React.ReactNode;
}) {
  const accent = brandColor || "#0c4a6e";
  const pathname = usePathname();
  const nav = [
    { href: "/portal", label: "My tickets", match: (p: string) => p === "/portal" },
    {
      href: "/portal/knowledge",
      label: "Help center",
      match: (p: string) => p.startsWith("/portal/knowledge"),
    },
    {
      href: "/portal/tickets/new",
      label: "New ticket",
      match: (p: string) => p.startsWith("/portal/tickets/new"),
    },
    {
      href: "/portal/profile",
      label: "Profile",
      match: (p: string) => p.startsWith("/portal/profile"),
    },
  ];

  return (
    <div
      className="min-h-full text-slate-900"
      style={{
        background: `radial-gradient(ellipse at top, ${accent}18 0%, #f8fafc 45%, #f1f5f9 100%)`,
      }}
    >
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-6">
            <Link href="/portal" className="flex min-w-0 items-center gap-3 leading-tight">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-lg object-contain"
                />
              ) : (
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                  style={{ background: accent }}
                >
                  {brandName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="min-w-0">
                <div
                  className="truncate text-xl font-semibold tracking-tight"
                  style={{ color: accent }}
                >
                  {brandName}
                </div>
                {!whiteLabel ? (
                  <div className="text-xs text-slate-500">Customer portal</div>
                ) : null}
              </span>
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              {nav.map((item) => {
                const active = item.match(pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-full px-3 py-1.5 text-sm transition ${
                      active
                        ? "font-medium text-white"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                    style={active ? { background: accent } : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <OrgSwitcher />
            <NotificationBell />
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 sm:hidden">
          {nav.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                  active ? "font-medium text-white" : "bg-slate-100 text-slate-600"
                }`}
                style={active ? { background: accent } : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}

/** Legacy thin shell for auth pages */
export function AppShell({
  brand,
  nav,
  userLabel,
  children,
}: {
  brand: { href: string; label: string; sub?: string };
  nav: { href: string; label: string }[];
  userLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_at_top,_#eef6ff_0%,_#f8fafc_45%,_#f1f5f9_100%)] text-zinc-900">
      <header className="border-b border-zinc-200/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href={brand.href} className="leading-tight">
              <div className="text-lg font-semibold tracking-tight text-sky-900">
                {brand.label}
              </div>
              {brand.sub ? (
                <div className="text-xs text-zinc-500">{brand.sub}</div>
              ) : null}
            </Link>
            <nav className="hidden items-center gap-3 sm:flex">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm text-zinc-600 hover:text-sky-800"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {userLabel ? (
              <span className="hidden text-zinc-500 sm:inline">{userLabel}</span>
            ) : null}
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-zinc-700 hover:bg-zinc-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
