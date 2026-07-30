import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff, requireOrgAdmin } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";

export async function GET() {
  try {
    const session = await requireStaff();
    const tags = await prisma.tag.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { name: "asc" },
    });
    return jsonOk({ tags });
  } catch (err) {
    return handleApiError(err);
  }
}

const schema = z.object({
  name: z.string().min(1).max(60),
  color: z.string().min(4).max(20).optional().default("#0369a1"),
});

export async function POST(req: Request) {
  try {
    const session = await requireOrgAdmin();
    const body = schema.parse(await req.json());
    const tag = await prisma.tag.create({
      data: {
        organizationId: session.user.organizationId,
        name: body.name.toLowerCase(),
        color: body.color,
      },
    });
    return jsonOk({ tag }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireOrgAdmin();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return jsonError("Missing id");
    const existing = await prisma.tag.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!existing) return jsonError("Not found", 404);
    await prisma.tag.delete({ where: { id } });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
