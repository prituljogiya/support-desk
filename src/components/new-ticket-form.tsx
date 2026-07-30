"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PRIORITIES } from "@/lib/tickets";

type Suggestion = {
  id: string;
  title: string;
  slug: string;
  category: string;
  excerpt: string;
};

export function NewTicketForm() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    const q = subject.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/portal/knowledge?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data) => setSuggestions((data.articles || []).slice(0, 4)))
        .catch(() => setSuggestions([]));
    }, 280);
    return () => clearTimeout(t);
  }, [subject]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, description, priority }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Failed to create ticket");
      return;
    }
    router.push(`/portal/tickets/${data.ticket.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4">
      {error ? (
        <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="rounded-lg border border-sky-100 bg-sky-50/80 px-3 py-2 text-sm text-sky-900">
        Tip: search the{" "}
        <Link href="/portal/knowledge" className="font-medium underline">
          help center
        </Link>{" "}
        first — you may get an answer without waiting for an agent.
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600">Subject</span>
        <input
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-sky-500"
        />
      </label>

      {suggestions.length > 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-emerald-800">
            Suggested articles
          </div>
          <ul className="mt-2 space-y-2">
            {suggestions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/portal/knowledge/${s.slug}`}
                  className="block rounded-lg bg-white px-3 py-2 text-sm shadow-sm hover:bg-sky-50"
                  target="_blank"
                >
                  <span className="font-medium text-slate-900">{s.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {s.category} · {s.excerpt}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600">Description</span>
        <textarea
          required
          rows={6}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-sky-500"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600">Priority</span>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="w-full rounded border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-sky-500"
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-sky-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60"
      >
        {loading ? "Submitting…" : "Submit ticket"}
      </button>
    </form>
  );
}
