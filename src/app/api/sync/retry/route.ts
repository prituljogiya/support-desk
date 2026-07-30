import { requireStaff } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { pullFreshdeskUpdates, retryPendingSync } from "@/lib/freshdesk/sync";

/** Retry outbound sync + optional inbound pull. Also usable as a cron target. */
export async function POST(req: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET?.trim();
    const authHeader = req.headers.get("authorization");
    const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

    let organizationId: string | undefined;
    if (!isCron) {
      const session = await requireStaff();
      organizationId = session.user.organizationId;
    }

    const retried = await retryPendingSync(organizationId);
    const pulled = await pullFreshdeskUpdates(organizationId);

    return jsonOk({ retried, pulled });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET(req: Request) {
  return POST(req);
}
