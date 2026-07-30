import type { TicketPriority, TicketStatus } from "@prisma/client";

export const STATUSES: TicketStatus[] = [
  "open",
  "pending",
  "resolved",
  "closed",
];

export const PRIORITIES: TicketPriority[] = [
  "low",
  "medium",
  "high",
  "urgent",
];

export function statusLabel(status: TicketStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function priorityLabel(priority: TicketPriority) {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

export function statusBadgeClass(status: TicketStatus) {
  switch (status) {
    case "open":
      return "bg-sky-100 text-sky-800";
    case "pending":
      return "bg-amber-100 text-amber-800";
    case "resolved":
      return "bg-emerald-100 text-emerald-800";
    case "closed":
      return "bg-zinc-200 text-zinc-700";
  }
}

export function priorityBadgeClass(priority: TicketPriority) {
  switch (priority) {
    case "low":
      return "bg-zinc-100 text-zinc-700";
    case "medium":
      return "bg-blue-100 text-blue-800";
    case "high":
      return "bg-orange-100 text-orange-800";
    case "urgent":
      return "bg-rose-100 text-rose-800";
  }
}

export function syncBadgeClass(syncStatus: string) {
  switch (syncStatus) {
    case "synced":
      return "bg-emerald-50 text-emerald-700";
    case "pending":
      return "bg-amber-50 text-amber-700";
    case "error":
      return "bg-rose-50 text-rose-700";
    default:
      return "bg-zinc-100 text-zinc-600";
  }
}
