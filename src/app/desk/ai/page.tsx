import { redirect } from "next/navigation";
import { auth, getOrgWithPlan } from "@/lib/auth";
import { isStaffRole, can } from "@/lib/features";
import { AiChatPanel } from "@/components/ai-chat-panel";
import Link from "next/link";

export default async function DeskAiPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");
  if (!isStaffRole(session.user.membershipRole)) redirect("/portal");

  const org = await getOrgWithPlan(session.user.organizationId);
  if (!org || !can(org, "aiAssistant")) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-semibold">AI not on this plan</h1>
        <p className="mt-2 text-sm text-slate-500">
          Upgrade or enable the AI Assistant feature on your plan.
        </p>
        <Link href="/desk" className="mt-4 inline-block text-sky-700">
          ← Back to inbox
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <AiChatPanel />
    </div>
  );
}
