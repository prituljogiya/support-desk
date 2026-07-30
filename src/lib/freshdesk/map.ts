import type { TicketPriority, TicketStatus } from "@prisma/client";

/** Freshdesk status: 2 Open, 3 Pending, 4 Resolved, 5 Closed */
export function toFreshdeskStatus(status: TicketStatus): number {
  switch (status) {
    case "open":
      return 2;
    case "pending":
      return 3;
    case "resolved":
      return 4;
    case "closed":
      return 5;
  }
}

export function fromFreshdeskStatus(status: number): TicketStatus {
  switch (status) {
    case 3:
      return "pending";
    case 4:
      return "resolved";
    case 5:
      return "closed";
    default:
      return "open";
  }
}

/** Freshdesk priority: 1 Low, 2 Medium, 3 High, 4 Urgent */
export function toFreshdeskPriority(priority: TicketPriority): number {
  switch (priority) {
    case "low":
      return 1;
    case "medium":
      return 2;
    case "high":
      return 3;
    case "urgent":
      return 4;
  }
}

export function fromFreshdeskPriority(priority: number): TicketPriority {
  switch (priority) {
    case 1:
      return "low";
    case 3:
      return "high";
    case 4:
      return "urgent";
    default:
      return "medium";
  }
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}
