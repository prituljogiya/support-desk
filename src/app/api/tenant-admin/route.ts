import { requireOrgAdmin } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { buildTenantAdminSnapshot } from "@/lib/tenant-admin";

export async function GET() {
  try {
    const session = await requireOrgAdmin();
    const snapshot = await buildTenantAdminSnapshot(
      session.user.organizationId,
    );
    if (!snapshot) return jsonError("Organization not found", 404);
    return jsonOk({
      ...snapshot,
      me: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.membershipRole,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
