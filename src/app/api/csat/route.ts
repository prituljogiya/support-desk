import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { canAccessPortalTicket } from "@/lib/portal-access";
import { isStaffRole } from "@/lib/features";

const schema = z.object({
  ticketId: z.string().min(1),
  score: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireOrgSession();
    const body = schema.parse(await req.json());

    const ticket = await prisma.ticket.findFirst({
      where: {
        id: body.ticketId,
        organizationId: session.user.organizationId,
      },
      include: { csat: true },
    });
    if (!ticket) return jsonError("Ticket not found", 404);
    if (ticket.status !== "resolved" && ticket.status !== "closed") {
      return jsonError("Rate tickets after they are resolved", 400);
    }
    if (ticket.csat) return jsonError("Already rated", 409);

    const isStaff = isStaffRole(session.user.membershipRole);
    if (!isStaff) {
      const ok = await canAccessPortalTicket({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        email: session.user.email!,
        role: session.user.membershipRole,
        ticketId: ticket.id,
      });
      if (!ok) return jsonError("Forbidden", 403);
    }

    const rating = await prisma.csatRating.create({
      data: {
        organizationId: session.user.organizationId,
        ticketId: ticket.id,
        score: body.score,
        comment: body.comment ?? null,
        ratedById: session.user.id,
      },
    });

    return jsonOk({ rating }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET(req: Request) {
  try {
    const session = await requireOrgSession();
    const ticketId = new URL(req.url).searchParams.get("ticketId");
    if (!ticketId) return jsonError("ticketId required", 400);

    const rating = await prisma.csatRating.findFirst({
      where: {
        ticketId,
        organizationId: session.user.organizationId,
      },
    });
    return jsonOk({ rating });
  } catch (err) {
    return handleApiError(err);
  }
}
