import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { syncMessageOutbound } from "@/lib/freshdesk/sync";
import { isStaffRole } from "@/lib/features";
import { canAccessPortalTicket } from "@/lib/portal-access";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  body: z.string().min(1).max(10000),
  isInternal: z.boolean().optional().default(false),
});

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await requireOrgSession();
    const { id } = await params;
    const ticket = await prisma.ticket.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!ticket) return jsonError("Ticket not found", 404);

    const isStaff = isStaffRole(session.user.membershipRole);
    if (!isStaff) {
      const ok = await canAccessPortalTicket({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        email: session.user.email!,
        role: session.user.membershipRole,
        ticketId: id,
      });
      if (!ok) return jsonError("Forbidden", 403);
    }

    const body = schema.parse(await req.json());
    if (body.isInternal && !isStaff) {
      return jsonError("Only agents can add internal notes", 403);
    }

    const message = await prisma.message.create({
      data: {
        ticketId: id,
        authorId: session.user.id,
        body: body.body,
        isInternal: body.isInternal,
        syncStatus: "pending",
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    const firstResponsePatch =
      isStaff && !body.isInternal && !ticket.firstRespondedAt
        ? { firstRespondedAt: new Date() }
        : {};

    await prisma.ticket.update({
      where: { id },
      data: {
        updatedAt: new Date(),
        ...firstResponsePatch,
        ...(!isStaff && ticket.status === "resolved"
          ? { status: "open", resolvedAt: null, syncStatus: "pending" }
          : {
              syncStatus:
                ticket.syncStatus === "synced" ? "pending" : ticket.syncStatus,
            }),
      },
    });

    await syncMessageOutbound(message.id);

    const refreshed = await prisma.message.findUnique({
      where: { id: message.id },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    return jsonOk({ message: refreshed }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
