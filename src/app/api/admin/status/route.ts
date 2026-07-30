import { requireStaff, getOrgWithPlan } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { isFreshdeskConfiguredForOrg } from "@/lib/freshdesk/client";
import { prisma } from "@/lib/prisma";
import { can, parsePlanFeatures } from "@/lib/features";

export async function GET() {
  try {
    const session = await requireStaff();
    const orgId = session.user.organizationId;
    const org = await getOrgWithPlan(orgId);
    const [open, pending, resolved, closed, syncErrors] = await Promise.all([
      prisma.ticket.count({ where: { organizationId: orgId, status: "open" } }),
      prisma.ticket.count({
        where: { organizationId: orgId, status: "pending" },
      }),
      prisma.ticket.count({
        where: { organizationId: orgId, status: "resolved" },
      }),
      prisma.ticket.count({
        where: { organizationId: orgId, status: "closed" },
      }),
      prisma.ticket.count({
        where: { organizationId: orgId, syncStatus: "error" },
      }),
    ]);

    const fdConfigured = org
      ? await isFreshdeskConfiguredForOrg(org.id)
      : false;

    return jsonOk({
      freshdeskConfigured: fdConfigured,
      domain:
        org?.freshdeskDomain?.trim() ||
        process.env.FRESHDESK_DOMAIN?.trim() ||
        null,
      canFreshdesk: org ? can(org, "freshdeskSync") : false,
      plan: org?.plan
        ? { key: org.plan.key, name: org.plan.name, features: parsePlanFeatures(org.plan.features) }
        : null,
      counts: { open, pending, resolved, closed, syncErrors },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
