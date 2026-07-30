import { redirect } from "next/navigation";

/** Reports moved into the enterprise Analytics center */
export default function ReportsRedirectPage() {
  redirect("/desk/analytics");
}
