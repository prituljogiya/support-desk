import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgSession, requirePermission, getOrgWithPlan } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { can } from "@/lib/features";

export async function GET(req: Request) {
  try {
    const session = await requirePermission("knowledge.view");
    const org = await getOrgWithPlan(session.user.organizationId);
    if (!org || !can(org, "knowledge")) {
      return jsonError("Knowledge base not available on this plan", 402);
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "";

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
      select: {
        id: true,
        title: true,
        slug: true,
        category: true,
        viewCount: true,
        helpfulVotes: true,
        updatedAt: true,
        body: true,
      },
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

    return jsonOk({
      articles: articles.map((a) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        category: a.category,
        viewCount: a.viewCount,
        helpfulVotes: a.helpfulVotes,
        updatedAt: a.updatedAt,
        excerpt: a.body.slice(0, 160).replace(/\s+/g, " ").trim(),
      })),
      categories: categories.map((c) => c.category),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

const voteSchema = z.object({
  slug: z.string().min(1),
  helpful: z.boolean(),
});

export async function POST(req: Request) {
  try {
    await requirePermission("knowledge.view");
    const session = await requireOrgSession();
    const org = await getOrgWithPlan(session.user.organizationId);
    if (!org || !can(org, "knowledge")) {
      return jsonError("Knowledge base not available on this plan", 402);
    }

    const body = voteSchema.parse(await req.json());
    const article = await prisma.knowledgeArticle.findUnique({
      where: {
        organizationId_slug: {
          organizationId: session.user.organizationId,
          slug: body.slug,
        },
      },
    });
    if (!article || !article.published) {
      return jsonError("Article not found", 404);
    }

    const updated = await prisma.knowledgeArticle.update({
      where: { id: article.id },
      data: body.helpful
        ? { helpfulVotes: { increment: 1 } }
        : { helpfulVotes: { decrement: article.helpfulVotes > 0 ? 1 : 0 } },
    });

    return jsonOk({ helpfulVotes: updated.helpfulVotes });
  } catch (err) {
    return handleApiError(err);
  }
}
