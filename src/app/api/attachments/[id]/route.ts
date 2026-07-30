import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import { canAccessPortalTicket } from "@/lib/portal-access";
import { isStaffRole } from "@/lib/features";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await requireOrgSession();
    const { id } = await params;
    const attachment = await prisma.attachment.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!attachment) return jsonError("Not found", 404);

    const isStaff = isStaffRole(session.user.membershipRole);
    if (!isStaff) {
      const ok = await canAccessPortalTicket({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        email: session.user.email!,
        role: session.user.membershipRole,
        ticketId: attachment.ticketId,
      });
      if (!ok) return jsonError("Forbidden", 403);
    }

    const buf = Buffer.from(attachment.dataBase64, "base64");
    return new Response(buf, {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": `attachment; filename="${attachment.filename.replace(/"/g, "")}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
