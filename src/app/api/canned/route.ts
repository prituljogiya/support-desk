import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff, requireOrgAdmin, getOrgWithPlan } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { can } from "@/lib/features";
import { suggestCannedReplies } from "@/lib/suggest";

export async function GET(req: Request) {
  try {
    const session = await requireStaff();
    const org = await getOrgWithPlan(session.user.organizationId);
    if (!org || !can(org, "cannedResponses")) {
      return jsonError("Canned responses not available on this plan", 402);
    }

    const { searchParams } = new URL(req.url);
    const suggestFor = searchParams.get("suggestFor");
    const subject = searchParams.get("subject") ?? "";
    const description = searchParams.get("description") ?? "";

    const canned = await prisma.cannedResponse.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { title: "asc" },
    });

    if (suggestFor === "1") {
      const suggestions = suggestCannedReplies(subject, description, canned);
      return jsonOk({ canned, suggestions });
    }

    return jsonOk({ canned });
  } catch (err) {
    return handleApiError(err);
  }
}

const schema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(10000),
  keywords: z.string().max(500).optional().default(""),
});

export async function POST(req: Request) {
  try {
    const session = await requireOrgAdmin();
    const org = await getOrgWithPlan(session.user.organizationId);
    if (!org || !can(org, "cannedResponses")) {
      return jsonError("Canned responses not available on this plan", 402);
    }

    const body = schema.parse(await req.json());
    const canned = await prisma.cannedResponse.create({
      data: {
        organizationId: session.user.organizationId,
        title: body.title,
        body: body.body,
        keywords: body.keywords,
        createdById: session.user.id,
      },
    });
    return jsonOk({ canned }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

const updateSchema = schema.extend({ id: z.string().min(1) });

export async function PATCH(req: Request) {
  try {
    const session = await requireOrgAdmin();
    const body = updateSchema.parse(await req.json());
    const existing = await prisma.cannedResponse.findFirst({
      where: { id: body.id, organizationId: session.user.organizationId },
    });
    if (!existing) return jsonError("Not found", 404);

    const canned = await prisma.cannedResponse.update({
      where: { id: body.id },
      data: {
        title: body.title,
        body: body.body,
        keywords: body.keywords,
      },
    });
    return jsonOk({ canned });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireOrgAdmin();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return jsonError("Missing id");
    const existing = await prisma.cannedResponse.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!existing) return jsonError("Not found", 404);
    await prisma.cannedResponse.delete({ where: { id } });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
