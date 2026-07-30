export function slaChip(dueAt: Date | string | null | undefined) {
  if (!dueAt) return null;
  const due = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  const ms = due.getTime() - Date.now();
  const absMin = Math.round(Math.abs(ms) / 60000);
  const label =
    absMin < 60
      ? `${absMin}m`
      : absMin < 60 * 24
        ? `${Math.round(absMin / 60)}h`
        : `${Math.round(absMin / (60 * 24))}d`;

  if (ms < 0) {
    return { state: "breached" as const, label: `-${label}`, due };
  }
  if (ms < 60 * 60 * 1000) {
    return { state: "urgent" as const, label, due };
  }
  return { state: "ok" as const, label, due };
}
