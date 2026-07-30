import { requireStaff } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { buildAnalyticsSnapshot } from "@/lib/analytics";

export async function GET(req: Request) {
  try {
    const session = await requireStaff();
    const { searchParams } = new URL(req.url);
    const to = searchParams.get("to")
      ? new Date(searchParams.get("to")!)
      : new Date();
    const from = searchParams.get("from")
      ? new Date(searchParams.get("from")!)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const snapshot = await buildAnalyticsSnapshot({
      organizationId: session.user.organizationId,
      from,
      to,
      agentId: searchParams.get("agentId") || undefined,
      department: searchParams.get("department") || undefined,
      channel: searchParams.get("channel") || undefined,
      companyId: searchParams.get("companyId") || undefined,
      priority: searchParams.get("priority") || undefined,
      status: searchParams.get("status") || undefined,
      tagId: searchParams.get("tagId") || undefined,
    });

    return jsonOk(snapshot);
  } catch (err) {
    return handleApiError(err);
  }
}
