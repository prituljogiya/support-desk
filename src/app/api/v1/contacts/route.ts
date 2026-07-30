import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/api-auth";
import { handleApiError, jsonOk } from "@/lib/api";

/** GET /api/v1/contacts */
export async function GET(req: Request) {
  try {
    const auth = await requireApiKey(req, "contacts:read");
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const limit = Math.min(Number(searchParams.get("limit") || 50), 100);

    const contacts = await prisma.contact.findMany({
      where: {
        organizationId: auth.organizationId,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        company: { select: { id: true, name: true } },
      },
    });

    return jsonOk({
      contacts,
      meta: { count: contacts.length, organizationId: auth.organizationId },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
