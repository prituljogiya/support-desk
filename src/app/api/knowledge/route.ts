import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff, requireOrgAdmin, getOrgWithPlan } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { can, slugify } from "@/lib/features";

export async function GET(req: Request) {
  try {
    const session = await requireStaff();
    const org = await getOrgWithPlan(session.user.organizationId);
    if (!org || !can(org, "knowledge")) {
      return jsonError("Knowledge base not available on this plan", 402);
    }

    const q = new URL(req.url).searchParams.get("q");
    const articles = await prisma.knowledgeArticle.findMany({
      where: {
        organizationId: session.user.organizationId,
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
      orderBy: { updatedAt: "desc" },
      include: { author: { select: { id: true, name: true } } },
    });
    return jsonOk({ articles });
  } catch (err) {
    return handleApiError(err);
  }
}

const schema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(50000),
  category: z.string().min(1).max(80).default("General"),
  published: z.boolean().optional().default(true),
});

export async function POST(req: Request) {
  try {
    const session = await requireOrgAdmin();
    const org = await getOrgWithPlan(session.user.organizationId);
    if (!org || !can(org, "knowledge")) {
      return jsonError("Knowledge base not available on this plan", 402);
    }

    const body = schema.parse(await req.json());
    let slug = slugify(body.title);
    const taken = await prisma.knowledgeArticle.findUnique({
      where: {
        organizationId_slug: {
          organizationId: session.user.organizationId,
          slug,
        },
      },
    });
    if (taken) slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;

    const article = await prisma.knowledgeArticle.create({
      data: {
        organizationId: session.user.organizationId,
        title: body.title,
        slug,
        body: body.body,
        category: body.category,
        published: body.published,
        authorId: session.user.id,
      },
    });
    return jsonOk({ article }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireOrgAdmin();
    const body = schema
      .partial()
      .extend({ id: z.string().min(1) })
      .parse(await req.json());
    const existing = await prisma.knowledgeArticle.findFirst({
      where: { id: body.id, organizationId: session.user.organizationId },
    });
    if (!existing) return jsonError("Not found", 404);

    const article = await prisma.knowledgeArticle.update({
      where: { id: body.id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.body !== undefined ? { body: body.body } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.published !== undefined ? { published: body.published } : {}),
      },
    });
    return jsonOk({ article });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireOrgAdmin();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return jsonError("Missing id");
    const existing = await prisma.knowledgeArticle.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!existing) return jsonError("Not found", 404);
    await prisma.knowledgeArticle.delete({ where: { id } });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
