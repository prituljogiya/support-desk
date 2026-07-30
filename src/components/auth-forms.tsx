"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

export function LoginForm({
  callbackUrl,
  initialEmail,
}: {
  callbackUrl?: string;
  initialEmail?: string;
}) {
  const [email, setEmail] = useState(initialEmail || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (res?.error) {
      setLoading(false);
      setError("Invalid email or password");
      return;
    }
    // Prefer server redirect target from callback, else land on home for role routing
    const dest =
      callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/";
    window.location.assign(dest);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? (
        <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-sky-500"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600">Password</span>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-sky-500"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-sky-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-sm text-zinc-500">
        New organization?{" "}
        <Link href="/signup" className="text-sky-700 hover:underline">
          Start free
        </Link>
      </p>
    </form>
  );
}

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, organizationName }),
    });
    const data = await res.json();
    if (!res.ok) {
      setLoading(false);
      setError(data.error || "Signup failed");
      return;
    }
    const sign = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (sign?.error) {
      router.push("/login");
      return;
    }
    router.push("/desk");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? (
        <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600">Your name</span>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-sky-500"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600">Work email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-sky-500"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600">Organization name</span>
        <input
          required
          value={organizationName}
          onChange={(e) => setOrganizationName(e.target.value)}
          className="w-full rounded border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-sky-500"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600">Password</span>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-sky-500"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-sky-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60"
      >
        {loading ? "Creating…" : "Create organization"}
      </button>
      <p className="text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="text-sky-700 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

/** Legacy customer-only register redirects to signup */
export function RegisterForm() {
  return <SignupForm />;
}
