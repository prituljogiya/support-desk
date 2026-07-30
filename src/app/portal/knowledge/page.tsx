import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, getOrgWithPlan } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/features";

type Props = { searchParams: Promise<{ q?: string; category?: string }> };

export default async function PortalKnowledgePage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const org = await getOrgWithPlan(session.user.organizationId);
  if (!org || !can(org, "knowledge")) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-8 text-center text-sm text-amber-900">
        Help center is not included on your organization&apos;s plan.
      </div>
    );
  }

  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  const category = sp.category?.trim() || "";

  const articles = await prisma.knowledgeArticle.findMany({
    where: {
      organizationId: session.user.organizationId,
      published: true,
      ...(category ? { category } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { body: { contains: q } },
              { category: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: [{ helpfulVotes: "desc" }, { updatedAt: "desc" }],
  });

  const categories = await prisma.knowledgeArticle.findMany({
    where: {
      organizationId: session.user.organizationId,
      published: true,
    },
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-sky-950">
          Help center
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Search articles before opening a ticket — faster answers, less waiting.
        </p>
      </div>

      <form className="flex flex-wrap gap-2" action="/portal/knowledge" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search help articles…"
          className="min-w-[220px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
        />
        {category ? <input type="hidden" name="category" value={category} /> : null}
        <button
          type="submit"
          className="rounded-lg bg-sky-800 px-4 py-2 text-sm font-medium text-white hover:bg-sky-900"
        >
          Search
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        <Link
          href={q ? `/portal/knowledge?q=${encodeURIComponent(q)}` : "/portal/knowledge"}
          className={`rounded-full px-3 py-1 text-sm ${
            !category
              ? "bg-sky-800 text-white"
              : "border border-slate-200 bg-white text-slate-600"
          }`}
        >
          All
        </Link>
        {categories.map((c) => {
          const href = q
            ? `/portal/knowledge?category=${encodeURIComponent(c.category)}&q=${encodeURIComponent(q)}`
            : `/portal/knowledge?category=${encodeURIComponent(c.category)}`;
          return (
            <Link
              key={c.category}
              href={href}
              className={`rounded-full px-3 py-1 text-sm ${
                category === c.category
                  ? "bg-sky-800 text-white"
                  : "border border-slate-200 bg-white text-slate-600"
              }`}
            >
              {c.category}
            </Link>
          );
        })}
      </div>

      {articles.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white/70 px-4 py-10 text-center text-sm text-slate-500">
          No articles match.{" "}
          <Link href="/portal/tickets/new" className="font-medium text-sky-800 hover:underline">
            Open a ticket
          </Link>{" "}
          instead.
        </p>
      ) : (
        <ul className="space-y-3">
          {articles.map((a) => (
            <li key={a.id}>
              <Link
                href={`/portal/knowledge/${a.slug}`}
                className="block rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-sky-200 hover:bg-sky-50/40"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {a.category}
                  </span>
                  <span className="text-xs text-slate-400">
                    {a.helpfulVotes} found helpful · {a.viewCount} views
                  </span>
                </div>
                <div className="mt-1 font-medium text-slate-900">{a.title}</div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                  {a.body.slice(0, 180).replace(/\s+/g, " ").trim()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
