import { redirect } from "next/navigation";
import { auth, getOrgWithPlan } from "@/lib/auth";
import { can, isStaffRole } from "@/lib/features";
import { hasPermission } from "@/lib/permissions";
import { KnowledgeWorkspace } from "@/components/knowledge-workspace";

export default async function KnowledgePage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");
  if (!isStaffRole(session.user.membershipRole)) redirect("/portal");

  const org = await getOrgWithPlan(session.user.organizationId);
  if (!org || !can(org, "knowledge")) {
    return (
      <div className="bg-white p-6">
        <h1 className="text-2xl font-semibold">Knowledge</h1>
        <p className="mt-2 text-sm text-amber-700">
          Knowledge base is not available on this plan.
        </p>
      </div>
    );
  }

  return (
    <KnowledgeWorkspace
      canManage={hasPermission(
        session.user.membershipRole,
        "knowledge.publish",
      )}
    />
  );
}
