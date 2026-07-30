"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InviteMemberForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("agent");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Failed to invite");
      return;
    }
    setMessage(
      `Invite link ready (share this — they join with one click, no signup form): ${typeof window !== "undefined" ? window.location.origin : ""}${data.invite.acceptUrl}`,
    );
    setEmail("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-3">
      {error ? (
        <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}
      <input
        required
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
      >
        <option value="agent">Support Agent</option>
        <option value="junior_agent">Junior Agent</option>
        <option value="supervisor">Team Lead / Supervisor</option>
        <option value="manager">Helpdesk Manager</option>
        <option value="admin">Tenant Admin</option>
        <option value="qa">QA Analyst</option>
        <option value="kb_editor">KB Editor</option>
        <option value="ai_manager">AI Manager</option>
        <option value="billing_manager">Billing Manager</option>
        <option value="developer">Developer / API</option>
        <option value="auditor">Auditor</option>
        <option value="customer">Customer</option>
        <option value="customer_manager">Customer Manager</option>
        <option value="guest">Guest</option>
      </select>
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60"
      >
        {loading ? "Sending…" : "Send invite"}
      </button>
    </form>
  );
}

export function SyncRetryButton() {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/sync/retry", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setResult(data.error || "Sync failed");
      return;
    }
    setResult(
      `Retried ${data.retried.tickets} tickets, ${data.retried.messages} messages; pulled ${data.pulled} updates`,
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-60"
      >
        {loading ? "Syncing…" : "Retry Freshdesk sync"}
      </button>
      {result ? <p className="text-sm text-zinc-600">{result}</p> : null}
    </div>
  );
}

export function OrgSettingsForm({
  initial,
}: {
  initial: {
    name: string;
    brandColor: string | null;
    logoUrl: string | null;
    freshdeskDomain: string | null;
    freshdeskApiKeySet: boolean;
    canFreshdesk: boolean;
  };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [brandColor, setBrandColor] = useState(initial.brandColor || "#0c4a6e");
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl || "");
  const [freshdeskDomain, setFreshdeskDomain] = useState(
    initial.freshdeskDomain || "",
  );
  const [freshdeskApiKey, setFreshdeskApiKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/org/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        brandColor,
        logoUrl: logoUrl || null,
        freshdeskDomain: freshdeskDomain || null,
        ...(freshdeskApiKey ? { freshdeskApiKey } : {}),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Save failed");
      return;
    }
    setMessage("Saved");
    setFreshdeskApiKey("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-3">
      {error ? (
        <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}
      <input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Organization name"
        className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
      />
      <input
        value={brandColor}
        onChange={(e) => setBrandColor(e.target.value)}
        placeholder="Brand color"
        className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
      />
      <input
        value={logoUrl}
        onChange={(e) => setLogoUrl(e.target.value)}
        placeholder="Logo URL (optional)"
        className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
      />
      {initial.canFreshdesk ? (
        <>
          <input
            value={freshdeskDomain}
            onChange={(e) => setFreshdeskDomain(e.target.value)}
            placeholder="Freshdesk domain"
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            type="password"
            value={freshdeskApiKey}
            onChange={(e) => setFreshdeskApiKey(e.target.value)}
            placeholder={
              initial.freshdeskApiKeySet
                ? "Freshdesk API key (leave blank to keep)"
                : "Freshdesk API key"
            }
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          />
        </>
      ) : (
        <p className="text-sm text-amber-700">
          Freshdesk sync requires Pro plan or higher.
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60"
      >
        {loading ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}

export function BillingActions({
  plans,
  currentPlanKey,
  stripeConfigured,
}: {
  plans: { key: string; name: string; description: string | null }[];
  currentPlanKey: string;
  stripeConfigured: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  async function assign(planKey: string) {
    setLoading(planKey);
    setMessage(null);
    const res = await fetch("/api/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planKey }),
    });
    const data = await res.json();
    setLoading(null);
    if (!res.ok) {
      setMessage(data.error || "Failed");
      return;
    }
    setMessage(`Plan set to ${planKey}`);
    router.refresh();
  }

  async function checkout(planKey: string) {
    setLoading(planKey);
    setMessage(null);
    const res = await fetch("/api/billing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planKey }),
    });
    const data = await res.json();
    setLoading(null);
    if (!res.ok) {
      setMessage(data.error || "Checkout failed");
      return;
    }
    window.location.href = data.url;
  }

  return (
    <div className="space-y-3">
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.key}
            className={`rounded-lg border p-4 ${
              p.key === currentPlanKey
                ? "border-sky-400 bg-sky-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="font-semibold text-slate-900">{p.name}</div>
            <p className="mt-1 text-xs text-slate-500">{p.description}</p>
            {p.key === currentPlanKey ? (
              <div className="mt-3 text-xs font-medium uppercase text-sky-700">
                Current
              </div>
            ) : p.key === "free" || !stripeConfigured ? (
              <button
                type="button"
                disabled={!!loading}
                onClick={() => assign(p.key)}
                className="mt-3 rounded border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                {loading === p.key ? "…" : "Assign"}
              </button>
            ) : (
              <button
                type="button"
                disabled={!!loading}
                onClick={() => checkout(p.key)}
                className="mt-3 rounded bg-sky-700 px-3 py-1.5 text-sm text-white hover:bg-sky-800"
              >
                {loading === p.key ? "…" : "Upgrade"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlatformOrgControls({
  organizationId,
  planKey,
  disabled,
}: {
  organizationId: string;
  planKey: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function patch(data: Record<string, unknown>) {
    setBusy(true);
    await fetch("/api/platform/orgs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId, ...data }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        disabled={busy}
        defaultValue={planKey}
        onChange={(e) => patch({ planKey: e.target.value })}
        className="rounded border border-slate-200 px-2 py-1 text-sm"
      >
        <option value="free">free</option>
        <option value="pro">pro</option>
        <option value="enterprise">enterprise</option>
      </select>
      <button
        type="button"
        disabled={busy}
        onClick={() => patch({ disabled: !disabled })}
        className="rounded border border-slate-200 px-2 py-1 text-sm"
      >
        {disabled ? "Enable" : "Disable"}
      </button>
    </div>
  );
}

/** @deprecated */
export function CreateAgentForm() {
  return <InviteMemberForm />;
}
