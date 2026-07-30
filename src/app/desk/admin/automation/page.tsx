import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, getOrgWithPlan } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, isOrgAdminRole } from "@/lib/features";
import { ASSIGNABLE_ROLES } from "@/lib/permissions";
import { AutomationPanel } from "@/components/automation-panel";

export default async function AutomationAdminPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");
  if (!isOrgAdminRole(session.user.membershipRole)) redirect("/desk");

  const orgId = session.user.organizationId;
  const [org, rules, agents, tags] = await Promise.all([
    getOrgWithPlan(orgId),
    prisma.automationRule.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.membership.findMany({
      where: {
        organizationId: orgId,
        role: { in: ASSIGNABLE_ROLES },
      },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.tag.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-4 bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Automations</h1>
          <p className="text-sm text-slate-500">
            Auto-assign, tag, and prioritize new tickets by keyword.
          </p>
        </div>
        <Link href="/desk/admin" className="text-sm text-sky-700 hover:underline">
          ← Admin
        </Link>
      </div>
      <AutomationPanel
        gated={!org || !can(org, "automation")}
        rules={rules}
        agents={agents.map((a) => ({ id: a.user.id, name: a.user.name }))}
        tags={tags.map((t) => ({ id: t.id, name: t.name }))}
      />
    </div>
  );
}
