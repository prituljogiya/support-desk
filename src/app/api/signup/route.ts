import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { slugify } from "@/lib/features";

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  organizationName: z.string().min(1).max(120),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const email = body.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return jsonError("Email already registered", 409);
    }

    const freePlan = await prisma.plan.findUnique({ where: { key: "free" } });
    if (!freePlan) {
      return jsonError("Plans not seeded. Run npm run db:seed.", 500);
    }

    let slug = slugify(body.organizationName);
    const slugTaken = await prisma.organization.findUnique({ where: { slug } });
    if (slugTaken) {
      slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const passwordHash = await bcrypt.hash(body.password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: body.name,
          email,
          passwordHash,
        },
      });

      const org = await tx.organization.create({
        data: {
          name: body.organizationName,
          slug,
          planId: freePlan.id,
          brandColor: "#0c4a6e",
        },
      });

      await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: "owner",
        },
      });

      await tx.businessHours.create({
        data: { organizationId: org.id },
      });

      await tx.slaPolicy.create({
        data: {
          organizationId: org.id,
          name: "Default",
          firstResponseMinutes: 480,
          resolutionMinutes: 2880,
          isDefault: true,
        },
      });

      await tx.syncCursor.create({
        data: { organizationId: org.id, key: "freshdesk" },
      });

      return { user, org };
    });

    return jsonOk(
      {
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
        },
        organization: {
          id: result.org.id,
          name: result.org.name,
          slug: result.org.slug,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
