"use client";

import { useCallback, useEffect, useState } from "react";

type KeyRow = {
  id: string;
  name: string;
  prefix: string;
  keyPreview: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export function ApiKeysPanel() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [docs, setDocs] = useState<{
    baseUrl: string;
    header: string;
    endpoints: string[];
  } | null>(null);
  const [name, setName] = useState("Integration key");
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/org/api-keys");
    const data = await res.json();
    if (res.ok) {
      setKeys(data.keys || []);
      setDocs(data.docs || null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSecret(null);
    const res = await fetch("/api/org/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        scopes: ["tickets:read", "tickets:write", "contacts:read"],
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not create key");
      return;
    }
    setSecret(data.secret);
    setName("Integration key");
    await load();
  }

  async function revoke(id: string) {
    if (!window.confirm("Revoke this API key? Integrations using it will stop working.")) {
      return;
    }
    await fetch("/api/org/api-keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">API keys</h2>
        <p className="mt-1 text-sm text-slate-500">
          Generate keys for third-party apps. They call your org data with a
          Bearer token — no browser login required.
        </p>
      </div>

      {docs ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div className="font-medium text-slate-900">How to call the API</div>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-emerald-200">
{`# List tickets
curl -H "${docs.header}" \\
  https://YOUR_DOMAIN/api/v1/tickets

# Create ticket
curl -X POST -H "${docs.header}" -H "Content-Type: application/json" \\
  -d '{"subject":"Help","description":"Details…","requesterEmail":"user@acme.com"}' \\
  https://YOUR_DOMAIN/api/v1/tickets`}
          </pre>
          <ul className="mt-3 list-inside list-disc text-xs text-slate-600">
            {docs.endpoints.map((ep) => (
              <li key={ep} className="font-mono">
                {ep}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form
        onSubmit={createKey}
        className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <label className="min-w-[200px] flex-1 text-sm">
          <span className="mb-1 block text-slate-600">Key name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-slate-200 px-3 py-2"
            placeholder="Zapier / mobile app"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? "Creating…" : "Generate key"}
        </button>
      </form>

      {error ? (
        <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      {secret ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <div className="font-medium text-amber-950">
            Copy your secret key now — it won&apos;t be shown again.
          </div>
          <code className="mt-2 block break-all rounded bg-white px-3 py-2 font-mono text-xs text-slate-800">
            {secret}
          </code>
          <button
            type="button"
            className="mt-2 text-xs font-medium text-amber-900 underline"
            onClick={() => void navigator.clipboard.writeText(secret)}
          >
            Copy to clipboard
          </button>
        </div>
      ) : null}

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {keys.map((k) => (
          <li
            key={k.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
          >
            <div>
              <div className="font-medium text-slate-900">
                {k.name}{" "}
                {k.revokedAt ? (
                  <span className="text-xs font-normal text-rose-600">
                    (revoked)
                  </span>
                ) : null}
              </div>
              <div className="font-mono text-xs text-slate-500">
                {k.keyPreview} · {k.scopes.join(", ")}
              </div>
              <div className="text-xs text-slate-400">
                Created {new Date(k.createdAt).toLocaleString()}
                {k.lastUsedAt
                  ? ` · Last used ${new Date(k.lastUsedAt).toLocaleString()}`
                  : " · Never used"}
              </div>
            </div>
            {!k.revokedAt ? (
              <button
                type="button"
                onClick={() => void revoke(k.id)}
                className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-700"
              >
                Revoke
              </button>
            ) : null}
          </li>
        ))}
        {!keys.length ? (
          <li className="px-4 py-8 text-center text-sm text-slate-400">
            No API keys yet. Generate one to connect an external app.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
