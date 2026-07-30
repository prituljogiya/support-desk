"use client";

import { useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export function AiChatPanel() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi — I'm **SmartDesk AI**, built into your product (no OpenAI or other third-party LLM). Ask about your knowledge base, open ticket volume, or recent tickets.",
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
        history: next.slice(-10),
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
      { role: "assistant", content: data.reply || "" },
    ]);
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-[28rem] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <h1 className="text-lg font-semibold text-slate-900">SmartDesk AI Chat</h1>
        <p className="text-xs text-slate-500">
          Your own in-product AI · answers from your KB and desk data · no third-party LLM APIs
        </p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => (
          <div
            key={`${i}-${m.role}`}
            className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
              m.role === "user"
                ? "ml-auto bg-slate-900 text-white"
                : "bg-violet-50 text-violet-950"
            }`}
          >
            {m.content.replace(/\*\*/g, "")}
          </div>
        ))}
        {busy ? (
          <div className="text-xs text-slate-400">Thinking with built-in AI…</div>
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
          placeholder="Ask about KB topics, open tickets, recent work…"
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
