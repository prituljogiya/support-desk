"use client";

import { useState } from "react";

export function ArticleHelpful({
  slug,
  initialVotes,
}: {
  slug: string;
  initialVotes: number;
}) {
  const [votes, setVotes] = useState(initialVotes);
  const [done, setDone] = useState<"yes" | "no" | null>(null);
  const [busy, setBusy] = useState(false);

  async function vote(helpful: boolean) {
    if (busy || done) return;
    setBusy(true);
    const res = await fetch("/api/portal/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, helpful }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setVotes(data.helpfulVotes ?? votes + (helpful ? 1 : 0));
      setDone(helpful ? "yes" : "no");
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-sm text-slate-600">
        Was this article helpful?
        <span className="ml-2 text-xs text-slate-400">{votes} yes</span>
      </div>
      {done ? (
        <span className="text-sm text-emerald-700">Thanks for the feedback.</span>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => vote(true)}
            className="rounded-full border border-slate-200 px-3 py-1 text-sm hover:bg-emerald-50"
          >
            Yes
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => vote(false)}
            className="rounded-full border border-slate-200 px-3 py-1 text-sm hover:bg-rose-50"
          >
            No
          </button>
        </div>
      )}
    </div>
  );
}
