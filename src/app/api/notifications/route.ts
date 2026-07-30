import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";

export async function GET() {
  try {
    const session = await requireOrgSession();
    const notifications = await prisma.notification.findMany({
      where: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    const unread = notifications.filter((n) => !n.readAt).length;
    return jsonOk({ notifications, unread });
  } catch (err) {
    return handleApiError(err);
  }
}

const schema = z.object({
  ids: z.array(z.string()).optional(),
  all: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  try {
    const session = await requireOrgSession();
    const body = schema.parse(await req.json());
    if (body.all) {
      await prisma.notification.updateMany({
        where: {
          organizationId: session.user.organizationId,
          userId: session.user.id,
          readAt: null,
        },
        data: { readAt: new Date() },
      });
    } else if (body.ids?.length) {
      await prisma.notification.updateMany({
        where: {
          id: { in: body.ids },
          userId: session.user.id,
          organizationId: session.user.organizationId,
        },
        data: { readAt: new Date() },
      });
    } else {
      return jsonError("Provide ids or all");
    }
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
