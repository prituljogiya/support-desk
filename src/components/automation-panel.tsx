"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Rule = {
  id: string;
  name: string;
  enabled: boolean;
  match: string;
  actions: string;
};

export function AutomationPanel({
  rules,
  agents,
  tags,
  gated,
}: {
  rules: Rule[];
  agents: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  gated: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("billing, invoice");
  const [assigneeId, setAssigneeId] = useState("");
  const [tagId, setTagId] = useState("");
  const [priority, setPriority] = useState("high");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (gated) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Automation rules require Pro+. Assign Pro in Billing to unlock
        auto-assign / auto-tag on new tickets.
      </div>
    );
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/automation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        match: {
          keywords: keywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
        },
        actions: {
          assigneeId: assigneeId || null,
          addTagIds: tagId ? [tagId] : [],
          setPriority: priority || undefined,
        },
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error || "Failed");
      return;
    }
    setName("");
    setMsg("Rule created");
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    await fetch(`/api/automation?id=${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form
        onSubmit={create}
        className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h3 className="font-semibold">New automation</h3>
        <p className="text-xs text-slate-500">
          Runs when a ticket is created. Matching keywords trigger assign / tag
          / priority.
        </p>
        {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Rule name"
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
        />
        <input
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="Keywords (comma-separated)"
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
        />
        <select
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
        >
          <option value="">No auto-assign</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              Assign {a.name}
            </option>
          ))}
        </select>
        <select
          value={tagId}
          onChange={(e) => setTagId(e.target.value)}
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
        >
          <option value="">No tag</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              Tag {t.name}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
        >
          <option value="">Keep priority</option>
          <option value="low">Set low</option>
          <option value="medium">Set medium</option>
          <option value="high">Set high</option>
          <option value="urgent">Set urgent</option>
        </select>
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-sky-700 px-3 py-1.5 text-sm text-white"
        >
          Create rule
        </button>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-semibold">Active rules</h3>
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {rules.length === 0 ? (
            <li className="py-6 text-center text-slate-400">No rules yet</li>
          ) : (
            rules.map((r) => (
              <li
                key={r.id}
                className="flex items-start justify-between gap-2 py-2"
              >
                <div>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-slate-500">
                    match: {r.match} · actions: {r.actions}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(r.id)}
                  className="text-xs text-rose-600"
                >
                  Delete
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
