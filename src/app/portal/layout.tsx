import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PortalShell } from "@/components/shell";
import { isPortalRole } from "@/lib/features";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.organizationId) {
    redirect(session.user.isSuperAdmin ? "/platform" : "/signup");
  }
  if (!isPortalRole(session.user.membershipRole)) redirect("/desk");

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      name: true,
      brandColor: true,
      logoUrl: true,
      whiteLabel: true,
    },
  });

  return (
    <PortalShell
      brandName={org?.name || session.user.organizationName || "Support"}
      brandColor={org?.brandColor}
      logoUrl={org?.logoUrl}
      whiteLabel={org?.whiteLabel}
    >
      {children}
    </PortalShell>
  );
}
