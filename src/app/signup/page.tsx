import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignupForm } from "@/components/auth-forms";

export default async function SignupPage() {
  const session = await auth();
  if (session?.user?.organizationId) {
    redirect(
      session.user.membershipRole === "customer" ? "/portal" : "/desk",
    );
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-[radial-gradient(ellipse_at_top,_#e0f2fe_0%,_#f8fafc_50%)] px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-sky-950">
          Start free
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Create your account and organization on the Free plan.
        </p>
        <div className="mt-6">
          <SignupForm />
        </div>
      </div>
    </div>
  );
}
