import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { homeForRole } from "@/lib/permissions";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    redirect(
      homeForRole(session.user.membershipRole, session.user.isSuperAdmin),
    );
  }

  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_at_top_left,_#dbeafe_0%,_#f8fafc_42%,_#e2e8f0_100%)]">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <div className="text-xl font-semibold tracking-tight text-sky-950">
          Support Desk
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/login" className="text-slate-600 hover:text-sky-800">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded bg-sky-800 px-3 py-1.5 font-medium text-white hover:bg-sky-900"
          >
            Start free
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 pb-20 pt-16">
        <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-sky-700">
          Multi-tenant helpdesk
        </p>
        <h1 className="max-w-2xl font-serif text-5xl font-semibold leading-tight tracking-tight text-sky-950">
          Support Desk
        </h1>
        <p className="mt-5 max-w-xl text-lg text-slate-600">
          Freshdesk-inspired agent inbox, customer portal, SLA timers, macros,
          and optional Freshdesk sync — for every organization on your platform.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="rounded bg-sky-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-900"
          >
            Create your organization
          </Link>
          <Link
            href="/login"
            className="rounded border border-slate-300 bg-white/80 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-white"
          >
            Sign in to demo
          </Link>
        </div>
      </section>

      <section className="border-t border-slate-200/80 bg-white/50 py-14">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 sm:grid-cols-3">
          {[
            {
              title: "Agent desk",
              body: "Dense inbox, ticket workspace, tags, SLA chips, and macros.",
            },
            {
              title: "Customer portal",
              body: "Branded ticket submit and track experience per organization.",
            },
            {
              title: "Plans & sync",
              body: "Feature gates, optional Stripe billing, per-org Freshdesk.",
            },
          ].map((f) => (
            <div key={f.title}>
              <h2 className="text-lg font-semibold text-sky-950">{f.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
