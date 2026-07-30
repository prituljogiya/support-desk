"use client";

import { useCallback, useEffect, useState } from "react";
import { FEATURE_LABELS, type FeatureKey, type PlanFeatures } from "@/lib/features";
import { colorAt } from "@/components/platform-charts";

type PlanRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  seatLimit: number;
  sortOrder: number;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  trialDays: number;
  active: boolean;
  features: PlanFeatures;
  tenantCount?: number;
};

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

const emptyForm = {
  key: "",
  name: "",
  description: "",
  seatLimit: 10,
  sortOrder: 0,
  monthlyPriceCents: 0,
  yearlyPriceCents: 0,
  trialDays: 0,
  active: true,
};

export function PlansEditor({ onChanged }: { onChanged?: () => void }) {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [featureKeys, setFeatureKeys] = useState<FeatureKey[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [features, setFeatures] = useState<Partial<PlanFeatures>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/platform/plans");
    const json = await res.json();
    if (res.ok) {
      setPlans(json.plans || []);
      setFeatureKeys(json.featureKeys || (Object.keys(FEATURE_LABELS) as FeatureKey[]));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startCreate() {
    setCreating(true);
    setEditingId(null);
    setForm({
      ...emptyForm,
      sortOrder: (plans[plans.length - 1]?.sortOrder ?? 0) + 1,
      key: "",
      name: "",
    });
    setFeatures({});
  }

  function startEdit(p: PlanRow) {
    setCreating(false);
    setEditingId(p.id);
    setForm({
      key: p.key,
      name: p.name,
      description: p.description || "",
      seatLimit: p.seatLimit,
      sortOrder: p.sortOrder,
      monthlyPriceCents: p.monthlyPriceCents,
      yearlyPriceCents: p.yearlyPriceCents,
      trialDays: p.trialDays,
      active: p.active,
    });
    setFeatures({ ...p.features });
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    const payload = {
      ...form,
      description: form.description || null,
      features,
    };
    const res = await fetch("/api/platform/plans", {
      method: creating ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        creating ? payload : { id: editingId, ...payload },
      ),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(json.error || "Save failed");
      return;
    }
    setMsg(creating ? `Created plan ${json.plan.key}` : `Updated ${json.plan.key}`);
    setCreating(false);
    setEditingId(null);
    await load();
    onChanged?.();
  }

  async function remove(p: PlanRow) {
    let reassignToPlanKey: string | undefined;
    if ((p.tenantCount || 0) > 0) {
      const other = plans.find((x) => x.id !== p.id && x.active);
      const key = window.prompt(
        `Plan has ${p.tenantCount} tenants. Reassign them to which plan key?`,
        other?.key || "free",
      );
      if (!key) return;
      reassignToPlanKey = key;
    } else if (!window.confirm(`Delete plan ${p.name}?`)) {
      return;
    }
    setBusy(true);
    const res = await fetch("/api/platform/plans", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, reassignToPlanKey }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(json.error || "Delete failed");
      return;
    }
    setMsg(`Deleted ${p.key}`);
    if (editingId === p.id) setEditingId(null);
    await load();
    onChanged?.();
  }

  const editing = creating || editingId;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            Plans
          </h2>
          <p className="text-sm text-slate-500">
            Create and edit subscription plans, pricing, seats, and features.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white"
        >
          + Add plan
        </button>
      </div>

      {msg ? (
        <p className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          {msg}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((p, i) => (
          <div
            key={p.id}
            className={`rounded-2xl border bg-white p-5 shadow-sm ${
              editingId === p.id
                ? "border-sky-400 ring-1 ring-sky-200"
                : "border-slate-200"
            } ${!p.active ? "opacity-70" : ""}`}
          >
            <div
              className="mb-3 h-1.5 w-12 rounded-full"
              style={{ background: colorAt(i) }}
            />
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-lg font-semibold text-slate-900">
                  {p.name}
                </div>
                <div className="font-mono text-xs text-slate-400">{p.key}</div>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  p.active
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {p.active ? "active" : "inactive"}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {p.description || "No description"}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-[10px] uppercase text-slate-400">Monthly</div>
                <div className="font-semibold">{money(p.monthlyPriceCents)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-400">Yearly</div>
                <div className="font-semibold">{money(p.yearlyPriceCents)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-400">Seats</div>
                <div className="font-semibold">{p.seatLimit}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-400">Trial</div>
                <div className="font-semibold">{p.trialDays}d</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-500">
              {p.tenantCount ?? 0} tenants · sort {p.sortOrder}
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {(Object.keys(p.features) as FeatureKey[])
                .filter((k) => p.features[k])
                .slice(0, 6)
                .map((k) => (
                  <span
                    key={k}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600"
                  >
                    {FEATURE_LABELS[k] || k}
                  </span>
                ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => startEdit(p)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void fetch("/api/platform/plans", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: p.id, active: !p.active }),
                  }).then(() => load())
                }
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs"
              >
                {p.active ? "Deactivate" : "Activate"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove(p)}
                className="rounded-full border border-rose-200 px-3 py-1.5 text-xs text-rose-700"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">
            {creating ? "New plan" : `Edit · ${form.key}`}
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs text-slate-500">
              Key (slug)
              <input
                required
                disabled={!creating && Boolean(editingId)}
                value={form.key}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    key: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                  }))
                }
                className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
                placeholder="growth"
              />
            </label>
            <label className="text-xs text-slate-500">
              Name
              <input
                required
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
            </label>
            <label className="text-xs text-slate-500">
              Description
              <input
                value={form.description}
                onChange={(e) =>
                  setForm((s) => ({ ...s, description: e.target.value }))
                }
                className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
            </label>
            <label className="text-xs text-slate-500">
              Seat limit
              <input
                type="number"
                min={1}
                value={form.seatLimit}
                onChange={(e) =>
                  setForm((s) => ({ ...s, seatLimit: Number(e.target.value) }))
                }
                className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
            </label>
            <label className="text-xs text-slate-500">
              Monthly price (cents)
              <input
                type="number"
                min={0}
                value={form.monthlyPriceCents}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    monthlyPriceCents: Number(e.target.value),
                  }))
                }
                className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
              <span className="text-[10px] text-slate-400">
                = {money(form.monthlyPriceCents)}/mo
              </span>
            </label>
            <label className="text-xs text-slate-500">
              Yearly price (cents)
              <input
                type="number"
                min={0}
                value={form.yearlyPriceCents}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    yearlyPriceCents: Number(e.target.value),
                  }))
                }
                className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
              <span className="text-[10px] text-slate-400">
                = {money(form.yearlyPriceCents)}/yr
              </span>
            </label>
            <label className="text-xs text-slate-500">
              Trial days
              <input
                type="number"
                min={0}
                value={form.trialDays}
                onChange={(e) =>
                  setForm((s) => ({ ...s, trialDays: Number(e.target.value) }))
                }
                className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
            </label>
            <label className="text-xs text-slate-500">
              Sort order
              <input
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((s) => ({ ...s, sortOrder: Number(e.target.value) }))
                }
                className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm((s) => ({ ...s, active: e.target.checked }))
                }
              />
              Active / sellable
            </label>
          </div>

          <h4 className="mt-5 text-sm font-semibold text-slate-800">Features</h4>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {featureKeys.map((key) => (
              <label
                key={key}
                className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm"
              >
                <span>{FEATURE_LABELS[key] || key}</span>
                <input
                  type="checkbox"
                  checked={Boolean(features[key])}
                  onChange={(e) =>
                    setFeatures((s) => ({ ...s, [key]: e.target.checked }))
                  }
                />
              </label>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={busy || !form.key || !form.name}
              onClick={() => void save()}
              className="rounded-full bg-sky-700 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {creating ? "Create plan" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setEditingId(null);
              }}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
