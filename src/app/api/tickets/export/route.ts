import { prisma } from "@/lib/prisma";
import { requireStaff, getOrgWithPlan } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import { can } from "@/lib/features";

export async function GET(req: Request) {
  try {
    const session = await requireStaff();
    const org = await getOrgWithPlan(session.user.organizationId);
    if (!org || !can(org, "export")) {
      return jsonError("Export not available on this plan", 402);
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const tickets = await prisma.ticket.findMany({
      where: {
        organizationId: session.user.organizationId,
        ...(status ? { status: status as never } : {}),
      },
      include: {
        requester: { select: { name: true, email: true } },
        assignee: { select: { name: true, email: true } },
        tags: { include: { tag: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 2000,
    });

    const header = [
      "id",
      "subject",
      "status",
      "priority",
      "requester",
      "requesterEmail",
      "assignee",
      "tags",
      "createdAt",
      "updatedAt",
      "syncStatus",
    ];
    const rows = tickets.map((t) =>
      [
        t.id,
        csv(t.subject),
        t.status,
        t.priority,
        csv(t.requester.name),
        t.requester.email,
        csv(t.assignee?.name ?? ""),
        csv(t.tags.map((x) => x.tag.name).join("|")),
        t.createdAt.toISOString(),
        t.updatedAt.toISOString(),
        t.syncStatus,
      ].join(","),
    );

    const csvBody = [header.join(","), ...rows].join("\n");
    return new Response(csvBody, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="tickets-${org.slug}.csv"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

function csv(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
