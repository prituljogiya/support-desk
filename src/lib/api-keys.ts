import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export const API_SCOPES = [
  "tickets:read",
  "tickets:write",
  "contacts:read",
  "contacts:write",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export function parseScopes(raw: string): ApiScope[] {
  try {
    const parsed = JSON.parse(raw) as string[];
    return parsed.filter((s): s is ApiScope =>
      (API_SCOPES as readonly string[]).includes(s),
    );
  } catch {
    return ["tickets:read", "contacts:read"];
  }
}

export function hashApiKey(rawKey: string) {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

/** Generate a new key. Returns plaintext once — store only the hash. */
export function generateApiKeyMaterial() {
  const secret = crypto.randomBytes(24).toString("base64url");
  const rawKey = `sd_live_${secret}`;
  const prefix = rawKey.slice(0, 16);
  return { rawKey, prefix, keyHash: hashApiKey(rawKey) };
}

export async function createOrgApiKey(opts: {
  organizationId: string;
  name: string;
  scopes?: ApiScope[];
  createdById?: string;
}) {
  const { rawKey, prefix, keyHash } = generateApiKeyMaterial();
  const scopes = opts.scopes?.length
    ? opts.scopes
    : (["tickets:read", "contacts:read"] as ApiScope[]);

  const row = await prisma.apiKey.create({
    data: {
      organizationId: opts.organizationId,
      name: opts.name,
      prefix,
      keyHash,
      scopes: JSON.stringify(scopes),
      createdById: opts.createdById ?? null,
    },
  });

  return { apiKey: row, rawKey, scopes };
}

export async function verifyBearerApiKey(authorizationHeader: string | null) {
  if (!authorizationHeader?.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  const rawKey = authorizationHeader.slice(7).trim();
  if (!rawKey.startsWith("sd_live_")) return null;

  const keyHash = hashApiKey(rawKey);
  const row = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: {
      organization: { select: { id: true, name: true, slug: true, disabled: true } },
    },
  });

  if (!row || row.revokedAt || row.organization.disabled) return null;

  // Fire-and-forget last used
  void prisma.apiKey
    .update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => undefined);

  return {
    apiKeyId: row.id,
    organizationId: row.organizationId,
    organization: row.organization,
    scopes: parseScopes(row.scopes),
  };
}

export function hasScope(
  scopes: ApiScope[],
  required: ApiScope | ApiScope[],
) {
  const need = Array.isArray(required) ? required : [required];
  return need.every((s) => scopes.includes(s));
}
