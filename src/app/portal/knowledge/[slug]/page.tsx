import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth, getOrgWithPlan } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/features";
import { ArticleHelpful } from "@/components/article-helpful";

type Props = { params: Promise<{ slug: string }> };

export default async function PortalArticlePage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const org = await getOrgWithPlan(session.user.organizationId);
  if (!org || !can(org, "knowledge")) {
    redirect("/portal");
  }

  const { slug } = await params;
  const article = await prisma.knowledgeArticle.findUnique({
    where: {
      organizationId_slug: {
        organizationId: session.user.organizationId,
        slug,
      },
    },
    include: { author: { select: { name: true } } },
  });

  if (!article || !article.published) notFound();

  await prisma.knowledgeArticle.update({
    where: { id: article.id },
    data: { viewCount: { increment: 1 } },
  });

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/portal/knowledge"
          className="text-sm text-sky-800 hover:underline"
        >
          ← Help center
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {article.category}
          </span>
          <span className="text-xs text-slate-400">
            Updated {article.updatedAt.toLocaleDateString()}
            {article.author?.name ? ` · ${article.author.name}` : ""}
          </span>
        </div>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-sky-950">
          {article.title}
        </h1>
      </div>

      <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-white px-5 py-6 text-sm leading-relaxed text-slate-800 shadow-sm">
        {article.body}
      </div>

      <ArticleHelpful slug={article.slug} initialVotes={article.helpfulVotes} />

      <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 px-4 py-5 text-center text-sm text-slate-600">
        Still need help?{" "}
        <Link
          href="/portal/tickets/new"
          className="font-medium text-sky-800 hover:underline"
        >
          Open a support ticket
        </Link>
      </div>
    </article>
  );
}
