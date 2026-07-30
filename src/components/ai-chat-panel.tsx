"use client";

import Link from "next/link";
import { useState } from "react";

type Msg = {
  role: "user" | "assistant";
  content: string;
  ticket?: { id: string; subject: string; link: string; priority: string } | null;
};

export function AiChatPanel() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi — I'm SmartDesk AI (built-in, no third-party LLM).\n\nAsk about your KB, open tickets, or say:\ncreate ticket: Login failing — customer cannot SSO\ncreate ticket for customer@email.com: Refund request",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setError(null);
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setBusy(true);
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        history: next
          .filter((m) => m.role === "user" || m.role === "assistant")
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Chat failed");
      return;
    }
    setMessages((m) => [
      ...m,
      {
        role: "assistant",
        content: data.reply || "",
        ticket: data.ticket || null,
      },
    ]);
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-[28rem] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <h1 className="text-lg font-semibold text-slate-900">SmartDesk AI Chat</h1>
        <p className="text-xs text-slate-500">
          Ask questions or create tickets — e.g. “create ticket: Billing issue”
        </p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => (
          <div key={`${i}-${m.role}`} className="space-y-2">
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "ml-auto bg-slate-900 text-white"
                  : "bg-violet-50 text-violet-950"
              }`}
            >
              {m.content.replace(/\*\*/g, "")}
            </div>
            {m.ticket ? (
              <Link
                href={m.ticket.link}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
              >
                Open ticket · {m.ticket.subject} ({m.ticket.priority})
              </Link>
            ) : null}
          </div>
        ))}
        {busy ? (
          <div className="text-xs text-slate-400">Working…</div>
        ) : null}
        {error ? (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
      </div>
      <form
        onSubmit={(e) => void send(e)}
        className="flex gap-2 border-t border-slate-100 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Try: create ticket: Refund for order 123'
          className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm outline-none focus:border-violet-400"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-full bg-violet-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
