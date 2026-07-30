import { redirect } from "next/navigation";

/** Billing lives inside the interactive Admin console */
export default function BillingPage() {
  redirect("/desk/admin");
}
