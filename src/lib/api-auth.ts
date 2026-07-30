import { AuthError } from "@/lib/auth-error";
import {
  hasScope,
  verifyBearerApiKey,
  type ApiScope,
} from "@/lib/api-keys";

export type ApiKeyAuth = NonNullable<
  Awaited<ReturnType<typeof verifyBearerApiKey>>
>;

/** Authenticate third-party clients via Authorization: Bearer sd_live_... */
export async function requireApiKey(
  req: Request,
  ...requiredScopes: ApiScope[]
): Promise<ApiKeyAuth> {
  const authz = req.headers.get("authorization");
  const verified = await verifyBearerApiKey(authz);
  if (!verified) {
    throw new AuthError("Invalid or missing API key", 401);
  }
  if (requiredScopes.length && !hasScope(verified.scopes, requiredScopes)) {
    throw new AuthError("API key missing required scope", 403);
  }
  return verified;
}
