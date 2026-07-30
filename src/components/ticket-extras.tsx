"use client";

import { useCallback, useEffect, useState } from "react";

type AttachmentRow = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export function TicketExtras({
  ticketId,
  status,
  mode,
}: {
  ticketId: string;
  status: string;
  mode: "portal" | "desk";
}) {
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [csat, setCsat] = useState<{ score: number } | null>(null);
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [aRes, cRes] = await Promise.all([
      fetch(`/api/attachments?ticketId=${ticketId}`),
      fetch(`/api/csat?ticketId=${ticketId}`),
    ]);
    const aJson = await aRes.json();
    const cJson = await cRes.json();
    if (aRes.ok) setAttachments(aJson.attachments || []);
    if (cRes.ok) setCsat(cJson.rating || null);
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || "");
      const dataBase64 = dataUrl.includes(",")
        ? dataUrl.split(",")[1]
        : dataUrl;
      const res = await fetch("/api/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          dataBase64,
        }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) {
        setMsg(data.error || "Upload failed");
        return;
      }
      e.target.value = "";
      await load();
    };
    reader.readAsDataURL(file);
  }

  async function submitCsat(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/csat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, score, comment: comment || undefined }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error || "Could not save rating");
      return;
    }
    setCsat({ score });
  }

  const showCsat =
    mode === "portal" &&
    (status === "resolved" || status === "closed") &&
    !csat;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Attachments</h3>
          <label className="cursor-pointer rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50">
            {busy ? "Uploading…" : "Add file"}
            <input
              type="file"
              className="hidden"
              onChange={(e) => void onFile(e)}
              disabled={busy}
            />
          </label>
        </div>
        {msg ? (
          <p className="mb-2 text-xs text-rose-600">{msg}</p>
        ) : null}
        <ul className="space-y-1 text-sm">
          {attachments.map((a) => (
            <li key={a.id}>
              <a
                href={`/api/attachments/${a.id}`}
                className="text-sky-800 hover:underline"
              >
                {a.filename}
              </a>{" "}
              <span className="text-xs text-slate-400">
                ({Math.round(a.sizeBytes / 1024)} KB)
              </span>
            </li>
          ))}
          {!attachments.length ? (
            <li className="text-xs text-slate-400">No attachments yet (max 2MB).</li>
          ) : null}
        </ul>
      </div>

      {csat ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Thanks — you rated this {csat.score}/5.
        </div>
      ) : null}

      {showCsat ? (
        <form
          onSubmit={submitCsat}
          className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 p-4"
        >
          <h3 className="text-sm font-semibold text-slate-900">
            How was our support?
          </h3>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setScore(n)}
                className={`h-9 w-9 rounded-full text-sm font-medium ${
                  score === n
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-700"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional comment"
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-60"
          >
            Submit rating
          </button>
        </form>
      ) : null}
    </div>
  );
}
