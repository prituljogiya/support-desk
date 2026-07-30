import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DeskShell } from "@/components/shell";
import { isStaffRole } from "@/lib/features";

export default async function DeskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.organizationId) {
    redirect(session.user.isSuperAdmin ? "/platform" : "/signup");
  }
  if (!isStaffRole(session.user.membershipRole)) redirect("/portal");

  return (
    <DeskShell orgName={session.user.organizationName}>{children}</DeskShell>
  );
}
