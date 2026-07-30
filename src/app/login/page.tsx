import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/auth-forms";
import { homeForRole } from "@/lib/permissions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; email?: string }>;
}) {
  const session = await auth();
  if (session?.user) {
    redirect(
      homeForRole(
        session.user.membershipRole,
        session.user.isSuperAdmin,
      ),
    );
  }
  const params = await searchParams;

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-[radial-gradient(ellipse_at_top,_#e0f2fe_0%,_#f8fafc_50%)] px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-sky-950">
          Support Desk
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Sign in to your organization workspace.
        </p>
        <div className="mt-6">
          <LoginForm
            callbackUrl={params.callbackUrl}
            initialEmail={params.email}
          />
        </div>
      </div>
    </div>
  );
}
