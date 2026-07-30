import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PortalProfileForm } from "@/components/portal-profile-form";

export default async function PortalProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-sky-950">
          Profile
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Your account details for this support portal.
        </p>
      </div>
      <PortalProfileForm
        initialName={session.user.name || ""}
        email={session.user.email || ""}
        role={session.user.membershipRole || "customer"}
        organizationName={session.user.organizationName || ""}
      />
    </div>
  );
}
