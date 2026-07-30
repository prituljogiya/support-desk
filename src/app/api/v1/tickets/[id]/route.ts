import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/api-auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

/** GET /api/v1/tickets/:id */
export async function GET(_req: Request, { params }: Params) {
  try {
    const auth = await requireApiKey(_req, "tickets:read");
    const { id } = await params;

    const ticket = await prisma.ticket.findFirst({
      where: { id, organizationId: auth.organizationId },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        messages: {
          where: { isInternal: false },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            body: true,
            createdAt: true,
            author: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!ticket) return jsonError("Ticket not found", 404);
    return jsonOk({ ticket });
  } catch (err) {
    return handleApiError(err);
  }
}
