import { prisma } from "@/lib/prisma";
import { requirePermission, getOrgWithPlan } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { can } from "@/lib/features";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await requirePermission("knowledge.view");
    const org = await getOrgWithPlan(session.user.organizationId);
    if (!org || !can(org, "knowledge")) {
      return jsonError("Knowledge base not available on this plan", 402);
    }

    const { slug } = await params;
    const article = await prisma.knowledgeArticle.findUnique({
      where: {
        organizationId_slug: {
          organizationId: session.user.organizationId,
          slug,
        },
      },
      include: { author: { select: { id: true, name: true } } },
    });

    if (!article || !article.published) {
      return jsonError("Article not found", 404);
    }

    const updated = await prisma.knowledgeArticle.update({
      where: { id: article.id },
      data: { viewCount: { increment: 1 } },
      include: { author: { select: { id: true, name: true } } },
    });

    return jsonOk({ article: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
