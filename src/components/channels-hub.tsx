"use client";

import { useCallback, useEffect, useState } from "react";

type ChannelRow = {
  id: string;
  type: string;
  name: string;
  label: string;
  description: string;
  status: string;
  enabled: boolean;
  featureLocked: boolean;
  featureKey: string | null;
  webhookSecret: string | null;
  phoneNumberId: string | null;
  hasAccessToken: boolean;
  verifyTokenSet: boolean;
  lastError: string | null;
  lastEventAt: string | null;
  externalId: string | null;
};

export function ChannelsHub({ orgSlug }: { orgSlug: string }) {
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [waToken, setWaToken] = useState("");
  const [waPhoneId, setWaPhoneId] = useState("");
  const [waVerify, setWaVerify] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/org/channels");
    const data = await res.json();
    if (res.ok) setChannels(data.channels || []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  async function connect(
    type: string,
    extra: Record<string, unknown> = {},
  ) {
    setBusy(type);
    setMsg(null);
    const res = await fetch("/api/org/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, action: "connect", ...extra }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) {
      setMsg(data.error || "Failed");
      return;
    }
    setMsg(`${type} connected`);
    await load();
  }

  async function disconnect(type: string) {
    setBusy(type);
    const res = await fetch("/api/org/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, action: "disconnect" }),
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json();
      setMsg(data.error || "Failed");
      return;
    }
    setMsg(`${type} disconnected`);
    await load();
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Channels</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Connect every place customers reach you. Portal and API work with one
          click. Email, WhatsApp, and chat use webhooks so tickets land in the
          same inbox — roles and replies stay consistent.
        </p>
      </div>

      {msg ? (
        <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">
          {msg}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {channels.map((ch) => {
          const connected = ch.status === "connected" && ch.enabled;
          return (
            <div
              key={ch.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {ch.label}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{ch.description}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    ch.featureLocked
                      ? "bg-amber-50 text-amber-800"
                      : connected
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {ch.featureLocked
                    ? "Plan locked"
                    : connected
                      ? "Connected"
                      : "Off"}
                </span>
              </div>

              {ch.type === "portal" || ch.type === "api" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {!connected ? (
                    <button
                      type="button"
                      disabled={Boolean(busy) || ch.featureLocked}
                      onClick={() => void connect(ch.type)}
                      className="rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
                    >
                      {busy === ch.type ? "…" : "Enable in one click"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => void disconnect(ch.type)}
                      className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700"
                    >
                      Disconnect
                    </button>
                  )}
                  {ch.type === "api" && connected ? (
                    <a
                      href="/desk/admin?section=settings-api"
                      className="rounded-full border border-slate-200 px-4 py-2 text-xs text-sky-800"
                    >
                      Manage API keys →
                    </a>
                  ) : null}
                  {ch.type === "portal" && connected ? (
                    <a
                      href="/portal"
                      className="rounded-full border border-slate-200 px-4 py-2 text-xs text-sky-800"
                    >
                      Open portal →
                    </a>
                  ) : null}
                </div>
              ) : null}

              {ch.type === "email" ? (
                <div className="mt-4 space-y-2 text-xs text-slate-600">
                  <code className="block break-all rounded bg-slate-50 px-2 py-1.5">
                    POST {origin}/api/webhooks/inbound-email
                  </code>
                  <p>
                    Auth: Bearer{" "}
                    <code className="rounded bg-slate-100 px-1">
                      {ch.webhookSecret || "secret"}
                    </code>{" "}
                    · body includes{" "}
                    <code className="rounded bg-slate-100 px-1">
                      org: &quot;{orgSlug}&quot;
                    </code>
                  </p>
                  <button
                    type="button"
                    disabled={Boolean(busy) || ch.featureLocked}
                    onClick={() => void connect("email")}
                    className="rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {connected
                      ? busy === "email"
                        ? "…"
                        : "Refresh / keep connected"
                      : busy === "email"
                        ? "…"
                        : "Connect email inbound"}
                  </button>
                </div>
              ) : null}

              {ch.type === "chat" ? (
                <div className="mt-4 space-y-2 text-xs text-slate-600">
                  <code className="block break-all rounded bg-slate-50 px-2 py-1.5">
                    POST {origin}/api/webhooks/chat
                  </code>
                  <p>
                    Bearer{" "}
                    <code className="rounded bg-slate-100 px-1">
                      {ch.webhookSecret || "…"}
                    </code>
                  </p>
                  <button
                    type="button"
                    disabled={Boolean(busy) || ch.featureLocked}
                    onClick={() => void connect("chat")}
                    className="rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {ch.featureLocked
                      ? "Upgrade for live chat"
                      : connected
                        ? "Connected — rotate ready"
                        : busy === "chat"
                          ? "…"
                          : "Enable live chat"}
                  </button>
                </div>
              ) : null}

              {ch.type === "whatsapp" ? (
                <div className="mt-4 space-y-2 text-xs text-slate-600">
                  <p>
                    Callback URL:{" "}
                    <code className="break-all rounded bg-slate-50 px-1">
                      {origin}/api/webhooks/whatsapp?org={orgSlug}
                    </code>
                  </p>
                  {ch.featureLocked ? (
                    <p className="text-amber-800">
                      WhatsApp requires a plan with the WhatsApp feature.
                    </p>
                  ) : (
                    <>
                      <input
                        className="w-full rounded border border-slate-200 px-2 py-1.5"
                        placeholder="Meta access token"
                        value={waToken}
                        onChange={(e) => setWaToken(e.target.value)}
                      />
                      <input
                        className="w-full rounded border border-slate-200 px-2 py-1.5"
                        placeholder="Phone number ID"
                        value={waPhoneId}
                        onChange={(e) => setWaPhoneId(e.target.value)}
                      />
                      <input
                        className="w-full rounded border border-slate-200 px-2 py-1.5"
                        placeholder="Verify token (optional)"
                        value={waVerify}
                        onChange={(e) => setWaVerify(e.target.value)}
                      />
                      <button
                        type="button"
                        disabled={Boolean(busy) || !waToken || !waPhoneId}
                        onClick={() =>
                          void connect("whatsapp", {
                            accessToken: waToken,
                            phoneNumberId: waPhoneId,
                            verifyToken: waVerify || undefined,
                          })
                        }
                        className="rounded-full bg-emerald-700 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
                      >
                        {busy === "whatsapp"
                          ? "Connecting…"
                          : connected
                            ? "Update WhatsApp connection"
                            : "Connect WhatsApp"}
                      </button>
                      {connected ? (
                        <p className="text-emerald-800">
                          Connected
                          {ch.phoneNumberId
                            ? ` · phone ${ch.phoneNumberId}`
                            : ""}
                          . Agent replies on WhatsApp tickets send via Meta.
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}

              {ch.lastEventAt ? (
                <p className="mt-3 text-[11px] text-slate-400">
                  Last event {new Date(ch.lastEventAt).toLocaleString()}
                </p>
              ) : null}
              {ch.lastError ? (
                <p className="mt-1 text-[11px] text-rose-600">{ch.lastError}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
