"use client";

import { useState } from "react";
import type { MembershipRole } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/permissions";

export function PortalProfileForm({
  initialName,
  email,
  role,
  organizationName,
}: {
  initialName: string;
  email: string;
  role: string;
  organizationName: string;
}) {
  const [name, setName] = useState(initialName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setError(null);
    const res = await fetch("/api/portal/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        ...(newPassword
          ? { currentPassword, newPassword }
          : {}),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not update profile");
      return;
    }
    setMsg("Profile saved.");
    setCurrentPassword("");
    setNewPassword("");
  }

  const roleLabel =
    ROLE_LABELS[role as MembershipRole] || role;

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      {error ? (
        <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}
      {msg ? (
        <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p>
      ) : null}

      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">Display name</span>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border border-slate-200 px-3 py-2 outline-none focus:border-sky-500"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">Email</span>
        <input
          disabled
          value={email}
          className="w-full rounded border border-slate-100 bg-slate-50 px-3 py-2 text-slate-500"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="text-sm">
          <div className="text-slate-500">Organization</div>
          <div className="font-medium text-slate-800">{organizationName}</div>
        </div>
        <div className="text-sm">
          <div className="text-slate-500">Role</div>
          <div className="font-medium text-slate-800">{roleLabel}</div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <div className="mb-2 text-sm font-medium text-slate-800">
          Change password
        </div>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-slate-600">Current password</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded border border-slate-200 px-3 py-2 outline-none focus:border-sky-500"
            autoComplete="current-password"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">New password</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded border border-slate-200 px-3 py-2 outline-none focus:border-sky-500"
            autoComplete="new-password"
            minLength={6}
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="rounded bg-sky-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-900 disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
