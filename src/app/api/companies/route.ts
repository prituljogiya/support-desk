import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff, requireOrgAdmin } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";

const schema = z.object({
  name: z.string().min(1).max(120),
  domain: z.string().max(120).nullable().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireOrgAdmin();
    const body = schema.parse(await req.json());
    const company = await prisma.company.create({
      data: {
        organizationId: session.user.organizationId,
        name: body.name.trim(),
        domain: body.domain?.trim() || null,
      },
    });
    return jsonOk({ company }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET() {
  try {
    const session = await requireStaff();
    const companies = await prisma.company.findMany({
      where: { organizationId: session.user.organizationId },
      include: { _count: { select: { contacts: true } } },
      orderBy: { name: "asc" },
    });
    return jsonOk({ companies });
  } catch (err) {
    return handleApiError(err);
  }
}
