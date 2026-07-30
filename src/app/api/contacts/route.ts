import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff, requireOrgAdmin, getOrgWithPlan } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { can } from "@/lib/features";

export async function GET() {
  try {
    const session = await requireStaff();
    const org = await getOrgWithPlan(session.user.organizationId);
    if (!org || !can(org, "contacts")) {
      return jsonError("Contacts not available", 402);
    }

    const contacts = await prisma.contact.findMany({
      where: { organizationId: session.user.organizationId },
      include: {
        company: { select: { id: true, name: true } },
        _count: { select: { tickets: true } },
      },
      orderBy: { name: "asc" },
    });
    return jsonOk({ contacts });
  } catch (err) {
    return handleApiError(err);
  }
}

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().max(40).optional().nullable(),
  companyName: z.string().max(120).optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const session = await requireOrgAdmin();
    const body = schema.parse(await req.json());
    const email = body.email.toLowerCase();

    let companyId: string | null = null;
    if (body.companyName?.trim()) {
      const existing = await prisma.company.findFirst({
        where: {
          organizationId: session.user.organizationId,
          name: body.companyName.trim(),
        },
      });
      if (existing) {
        companyId = existing.id;
      } else {
        const created = await prisma.company.create({
          data: {
            organizationId: session.user.organizationId,
            name: body.companyName.trim(),
          },
        });
        companyId = created.id;
      }
    }

    const contact = await prisma.contact.create({
      data: {
        organizationId: session.user.organizationId,
        name: body.name,
        email,
        phone: body.phone ?? null,
        companyId,
        createdById: session.user.id,
      },
      include: { company: { select: { id: true, name: true } } },
    });

    return jsonOk({ contact }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
