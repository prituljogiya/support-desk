import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isOrgAdminRole } from "@/lib/features";
import { TenantAdminApp } from "@/components/tenant-admin-app";

export default async function TenantAdminPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");
  if (!isOrgAdminRole(session.user.membershipRole)) redirect("/desk");

  return <TenantAdminApp />;
}
