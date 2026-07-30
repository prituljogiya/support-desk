import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { getInvitePreview } from "@/lib/invite-accept";
import { homeForRole } from "@/lib/permissions";

export async function GET(req: Request) {
  try {
    const token = new URL(req.url).searchParams.get("token");
    if (!token) return jsonError("token required", 400);

    const preview = await getInvitePreview(token);
    if (!preview) return jsonError("Invite not found", 404);

    return jsonOk({
      invite: preview,
      home: homeForRole(preview.role),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
