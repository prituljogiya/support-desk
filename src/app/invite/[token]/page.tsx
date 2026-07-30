"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/invites", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        name: name || undefined,
        password: password || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setLoading(false);
      setError(data.error || "Could not accept invite");
      return;
    }

    if (password) {
      await signIn("credentials", {
        email: data.email,
        password,
        redirect: false,
      });
      await fetch("/api/orgs/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: data.organizationId }),
      });
    }

    setLoading(false);
    router.push(data.role === "customer" ? "/portal" : "/desk");
    router.refresh();
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-[radial-gradient(ellipse_at_top,_#e0f2fe_0%,_#f8fafc_50%)] px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-sky-950">
          Accept invite
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Join the organization. New accounts need a name and password.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {error ? (
            <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}
          <input
            placeholder="Name (new accounts)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            type="password"
            minLength={6}
            placeholder="Password (new accounts)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-sky-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60"
          >
            {loading ? "Accepting…" : "Accept invite"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-zinc-500">
          Already signed in?{" "}
          <Link href="/login" className="text-sky-700 hover:underline">
            Sign in first
          </Link>
        </p>
      </div>
    </div>
  );
}
