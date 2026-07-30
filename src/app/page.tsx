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
    <div className="min-h-full overflow-x-hidden bg-[var(--background)] text-[var(--foreground)]">
      {/* Full-bleed hero */}
      <section className="relative isolate min-h-[100svh] overflow-hidden">
        <div
          aria-hidden
          className="landing-drift absolute inset-0 -z-10"
          style={{
            background: `
              radial-gradient(ellipse 90% 70% at 15% 10%, #9fd5c8 0%, transparent 55%),
              radial-gradient(ellipse 70% 60% at 90% 20%, #c5d9e8 0%, transparent 50%),
              radial-gradient(ellipse 80% 50% at 50% 100%, #dfe8e2 0%, transparent 45%),
              linear-gradient(165deg, #eef4f1 0%, #f3f6f4 40%, #e7eeea 100%)
            `,
          }}
        />
        <div
          aria-hidden
          className="landing-fade pointer-events-none absolute inset-0 -z-10 opacity-[0.35]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(12, 26, 23, 0.04) 1px, transparent 1px),
              linear-gradient(90deg, rgba(12, 26, 23, 0.04) 1px, transparent 1px)
            `,
            backgroundSize: "64px 64px",
            maskImage:
              "radial-gradient(ellipse at center, black 20%, transparent 75%)",
          }}
        />

        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
          <div className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--brand)] sm:text-3xl">
            Support Desk
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/login"
              className="text-[var(--brand-soft)] transition hover:text-[var(--brand)]"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-[var(--brand)] px-4 py-2 font-medium text-white transition hover:bg-[var(--brand-soft)]"
            >
              Start free
            </Link>
          </nav>
        </header>

        <div className="mx-auto flex min-h-[calc(100svh-5.5rem)] w-full max-w-6xl flex-col justify-between gap-12 px-5 pb-10 pt-8 sm:px-8 lg:pb-14">
          <div className="max-w-3xl pt-6 lg:pt-16">
            <h1 className="landing-rise font-[family-name:var(--font-display)] text-[clamp(2.75rem,8vw,5.75rem)] font-semibold leading-[0.95] tracking-[-0.03em] text-[var(--brand)]">
              Support Desk
            </h1>
            <p className="landing-rise landing-rise-delay-1 mt-6 max-w-xl text-lg leading-relaxed text-[var(--brand-soft)] sm:text-xl">
              The multi-tenant helpdesk for teams that need a clear inbox,
              a branded customer portal, and operations they can trust.
            </p>
            <div className="landing-rise landing-rise-delay-2 mt-10 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-bright)] hover:text-[var(--brand)]"
              >
                Create your workspace
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-[var(--brand)]/20 bg-white/60 px-6 py-3 text-sm font-semibold text-[var(--brand)] backdrop-blur transition hover:bg-white"
              >
                Sign in
              </Link>
            </div>
          </div>

          {/* Dominant product visual — edge-to-edge stage */}
          <div className="landing-rise landing-rise-delay-3 relative -mx-5 min-h-[42vh] overflow-hidden sm:-mx-8 lg:min-h-[38vh]">
            <div
              aria-hidden
              className="absolute inset-0 bg-[var(--brand)]"
            />
            <div
              aria-hidden
              className="absolute inset-0 opacity-40"
              style={{
                background:
                  "radial-gradient(ellipse at 30% 0%, #14b8a6 0%, transparent 55%), radial-gradient(ellipse at 90% 80%, #1a3d36 0%, transparent 50%)",
              }}
            />
            <div className="relative flex h-full min-h-[42vh] items-end px-5 pb-0 pt-10 sm:px-10 lg:min-h-[38vh]">
              <div className="w-full overflow-hidden rounded-t-2xl border border-white/15 border-b-0 bg-[#0a1614]/90 shadow-[0_-20px_60px_rgba(0,0,0,0.25)] backdrop-blur">
                <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
                  <span className="ml-3 text-xs text-white/40">Agent inbox</span>
                </div>
                <div className="grid grid-cols-12 gap-0 text-left">
                  <div className="col-span-4 hidden border-r border-white/10 p-4 sm:block">
                    {["Open queue", "Waiting on customer", "Resolved today"].map(
                      (label, i) => (
                        <div
                          key={label}
                          className={`mb-2 rounded-lg px-3 py-2 text-xs ${
                            i === 0
                              ? "bg-[var(--accent)]/30 text-teal-100"
                              : "text-white/45"
                          }`}
                        >
                          {label}
                        </div>
                      ),
                    )}
                  </div>
                  <div className="col-span-12 space-y-2 p-4 sm:col-span-8">
                    {[
                      ["Billing portal access", "High · 12m"],
                      ["Shipping delay — order 4821", "Medium · 41m"],
                      ["API key rotation help", "Low · 2h"],
                    ].map(([title, meta]) => (
                      <div
                        key={title}
                        className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/5 px-3 py-3"
                      >
                        <span className="truncate text-sm text-white/90">
                          {title}
                        </span>
                        <span className="shrink-0 text-xs text-white/40">
                          {meta}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* One job: what you get */}
      <section className="border-t border-[var(--brand)]/8 bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <h2 className="max-w-2xl font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--brand)] sm:text-4xl">
            Everything your support team runs on — in one platform.
          </h2>
          <p className="mt-4 max-w-xl text-[var(--brand-soft)]">
            Built for agencies and product companies that host many brands
            under one account.
          </p>

          <div className="mt-14 grid gap-12 sm:grid-cols-3 sm:gap-10">
            {[
              {
                title: "Agent workspace",
                body: "Kanban and list inbox, ticket threads, macros, tags, and SLA timers that keep queues moving.",
              },
              {
                title: "Customer portal",
                body: "Branded help center, ticket status tracking, and one-click invite login for your customers.",
              },
              {
                title: "Platform control",
                body: "Plans, seats, org health, and analytics for every tenant you operate.",
              },
            ].map((item) => (
              <div key={item.title} className="border-t border-[var(--mist)] pt-6">
                <h3 className="text-lg font-semibold text-[var(--brand)]">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--brand-soft)]">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* One job: how it works */}
      <section className="bg-[var(--fog)] py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--brand)] sm:text-4xl">
            Live in minutes.
          </h2>
          <ol className="mt-12 grid gap-10 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Create a workspace",
                body: "Sign up, name your organization, and invite your team.",
              },
              {
                step: "02",
                title: "Open the desk",
                body: "Agents triage tickets while customers use your portal and help center.",
              },
              {
                step: "03",
                title: "Grow on plans",
                body: "Unlock SLA, automation, analytics, and higher seats as you scale.",
              },
            ].map((item) => (
              <li key={item.step}>
                <div className="font-[family-name:var(--font-display)] text-sm font-medium text-[var(--accent)]">
                  {item.step}
                </div>
                <h3 className="mt-3 text-lg font-semibold text-[var(--brand)]">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--brand-soft)]">
                  {item.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative overflow-hidden bg-[var(--brand)] py-24 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[var(--accent)]/30 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
          <h2 className="max-w-xl font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-5xl">
            Ready when your customers are.
          </h2>
          <p className="mt-4 max-w-md text-white/70">
            Start on the free plan. Upgrade when your team needs more seats and
            deeper operations tools.
          </p>
          <Link
            href="/signup"
            className="mt-10 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-[var(--brand)] transition hover:bg-[var(--fog)]"
          >
            Start free
          </Link>
        </div>
      </section>

      <footer className="border-t border-[var(--brand)]/10 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 text-sm text-[var(--brand-soft)] sm:px-8">
          <span className="font-[family-name:var(--font-display)] font-semibold text-[var(--brand)]">
            Support Desk
          </span>
          <div className="flex gap-5">
            <Link href="/login" className="hover:text-[var(--brand)]">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-[var(--brand)]">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
