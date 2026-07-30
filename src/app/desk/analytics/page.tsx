import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isStaffRole } from "@/lib/features";
import { AnalyticsCenter } from "@/components/analytics-center";

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");
  if (!isStaffRole(session.user.membershipRole)) redirect("/portal");

  return <AnalyticsCenter />;
}
