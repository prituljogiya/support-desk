import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { canAccessPortalTicket } from "@/lib/portal-access";
import { isStaffRole } from "@/lib/features";
import { hasPermission } from "@/lib/permissions";

const MAX_BYTES = 2 * 1024 * 1024;

async function assertTicketAccess(
  session: Awaited<ReturnType<typeof requireOrgSession>>,
  ticketId: string,
) {
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, organizationId: session.user.organizationId },
  });
  if (!ticket) return null;

  const isStaff = isStaffRole(session.user.membershipRole);
  if (isStaff) return ticket;

  if (!hasPermission(session.user.membershipRole, "tickets.attach")) {
    return null;
  }

  const ok = await canAccessPortalTicket({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    email: session.user.email!,
    role: session.user.membershipRole,
    ticketId,
  });
  return ok ? ticket : null;
}

export async function GET(req: Request) {
  try {
    const session = await requireOrgSession();
    const ticketId = new URL(req.url).searchParams.get("ticketId");
    if (!ticketId) return jsonError("ticketId required", 400);
    const ticket = await assertTicketAccess(session, ticketId);
    if (!ticket) return jsonError("Forbidden", 403);

    const attachments = await prisma.attachment.findMany({
      where: {
        ticketId,
        organizationId: session.user.organizationId,
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
        uploadedById: true,
      },
    });
    return jsonOk({ attachments });
  } catch (err) {
    return handleApiError(err);
  }
}

const uploadSchema = z.object({
  ticketId: z.string().min(1),
  filename: z.string().min(1).max(200),
  mimeType: z.string().min(3).max(120),
  dataBase64: z.string().min(1),
  messageId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireOrgSession();
    const body = uploadSchema.parse(await req.json());
    const ticket = await assertTicketAccess(session, body.ticketId);
    if (!ticket) return jsonError("Forbidden", 403);

    const sizeBytes = Math.ceil((body.dataBase64.length * 3) / 4);
    if (sizeBytes > MAX_BYTES) {
      return jsonError("File too large (max 2MB)", 413);
    }

    const attachment = await prisma.attachment.create({
      data: {
        organizationId: session.user.organizationId,
        ticketId: body.ticketId,
        messageId: body.messageId ?? null,
        filename: body.filename,
        mimeType: body.mimeType,
        sizeBytes,
        dataBase64: body.dataBase64,
        uploadedById: session.user.id,
      },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
      },
    });

    await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: { storageUsedBytes: { increment: sizeBytes } },
    });

    return jsonOk({ attachment }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
