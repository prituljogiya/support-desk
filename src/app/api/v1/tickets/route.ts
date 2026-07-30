import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/api-auth";
import { handleApiError, jsonOk } from "@/lib/api";

/** GET /api/v1/tickets — list tickets for the API key's organization */
export async function GET(req: Request) {
  try {
    const auth = await requireApiKey(req, "tickets:read");
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = Math.min(Number(searchParams.get("limit") || 50), 100);

    const tickets = await prisma.ticket.findMany({
      where: {
        organizationId: auth.organizationId,
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        subject: true,
        status: true,
        priority: true,
        channel: true,
        createdAt: true,
        updatedAt: true,
        requester: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    return jsonOk({
      tickets,
      meta: { count: tickets.length, organizationId: auth.organizationId },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
