import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PlatformConsole } from "@/components/platform-console";

export default async function PlatformPage() {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) redirect("/desk");

  return (
    <PlatformConsole
      email={session.user.email}
      name={session.user.name}
    />
  );
}
