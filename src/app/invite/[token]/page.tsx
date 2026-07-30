"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ROLE_LABELS } from "@/lib/permissions";
import type { MembershipRole } from "@prisma/client";

type Preview = {
  email: string;
  role: MembershipRole;
  organizationName: string;
  status: string;
  expired: boolean;
  existingUser: boolean;
};

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [home, setHome] = useState("/desk");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/invites/preview?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Invite not found");
          return;
        }
        setPreview(data.invite);
        setHome(data.home || "/desk");
      })
      .catch(() => setError("Could not load invite"))
      .finally(() => setBooting(false));
  }, [token]);

  async function accept() {
    if (!token) return;
    setLoading(true);
    setError(null);

    const res = await signIn("invite", {
      inviteToken: token,
      redirect: false,
    });

    setLoading(false);

    if (res?.error || !res?.ok) {
      setError(
        "This invite link is invalid, expired, or already used. Sign in with your email instead.",
      );
      return;
    }

    router.push(home);
    router.refresh();
  }

  if (booting) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center px-4">
        <p className="text-sm text-zinc-500">Loading invite…</p>
      </div>
    );
  }

  const roleLabel = preview
    ? ROLE_LABELS[preview.role] || preview.role
    : "";

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-[radial-gradient(ellipse_at_top,_#e0f2fe_0%,_#f8fafc_50%)] px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-sky-950">
          You&apos;re invited
        </h1>

        {error && !preview ? (
          <p className="mt-4 rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        {preview ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-zinc-600">
              Join <span className="font-semibold text-zinc-900">{preview.organizationName}</span>{" "}
              as <span className="font-medium">{roleLabel}</span>.
            </p>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-slate-400">
                Signed in as
              </div>
              <div className="mt-0.5 font-medium text-slate-900">{preview.email}</div>
            </div>

            {preview.expired || preview.status !== "pending" ? (
              <div className="space-y-3">
                <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {preview.expired
                    ? "This invite has expired."
                    : "This invite was already used."}{" "}
                  Sign in with your email to continue.
                </p>
                <Link
                  href={`/login?email=${encodeURIComponent(preview.email)}`}
                  className="block w-full rounded bg-sky-700 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-sky-800"
                >
                  Go to sign in
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {error ? (
                  <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {error}
                  </p>
                ) : null}
                <p className="text-sm text-zinc-500">
                  {preview.existingUser
                    ? "Click below to join this organization — no password needed on this link."
                    : "Click below to create your access and enter — no signup form needed. You can set a password later in Profile."}
                </p>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void accept()}
                  className="w-full rounded bg-sky-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60"
                >
                  {loading ? "Joining…" : "Accept invite & continue"}
                </button>
              </div>
            )}
          </div>
        ) : null}

        <p className="mt-6 text-center text-sm text-zinc-500">
          Prefer password login?{" "}
          <Link
            href={
              preview
                ? `/login?email=${encodeURIComponent(preview.email)}`
                : "/login"
            }
            className="text-sky-700 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
