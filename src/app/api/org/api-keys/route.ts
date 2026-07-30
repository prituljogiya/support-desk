import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import {
  API_SCOPES,
  createOrgApiKey,
  parseScopes,
  type ApiScope,
} from "@/lib/api-keys";

export async function GET() {
  try {
    const session = await requirePermission("api.keys");
    const keys = await prisma.apiKey.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });

    return jsonOk({
      keys: keys.map((k) => ({
        ...k,
        scopes: parseScopes(k.scopes),
        keyPreview: `${k.prefix}…`,
      })),
      availableScopes: API_SCOPES,
      docs: {
        baseUrl: "/api/v1",
        header: "Authorization: Bearer sd_live_…",
        endpoints: [
          "GET /api/v1/tickets",
          "GET /api/v1/tickets/:id",
          "GET /api/v1/contacts",
        ],
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

const createSchema = z.object({
  name: z.string().min(2).max(80),
  scopes: z
    .array(z.enum(["tickets:read", "tickets:write", "contacts:read", "contacts:write"]))
    .min(1)
    .optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requirePermission("api.keys");
    const body = createSchema.parse(await req.json());
    const { apiKey, rawKey, scopes } = await createOrgApiKey({
      organizationId: session.user.organizationId,
      name: body.name,
      scopes: (body.scopes || ["tickets:read", "contacts:read"]) as ApiScope[],
      createdById: session.user.id,
    });

    await writeAuditLog({
      action: "api_key.create",
      actorUserId: session.user.id,
      organizationId: session.user.organizationId,
      meta: { id: apiKey.id, name: apiKey.name, prefix: apiKey.prefix },
    });

    return jsonOk(
      {
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          prefix: apiKey.prefix,
          scopes,
          createdAt: apiKey.createdAt,
        },
        // Shown once — client must copy it
        secret: rawKey,
        warning: "Copy this key now. It will not be shown again.",
      },
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}

const revokeSchema = z.object({ id: z.string().min(1) });

export async function DELETE(req: Request) {
  try {
    const session = await requirePermission("api.keys");
    const body = revokeSchema.parse(await req.json());
    const existing = await prisma.apiKey.findFirst({
      where: {
        id: body.id,
        organizationId: session.user.organizationId,
      },
    });
    if (!existing) return jsonError("API key not found", 404);

    await prisma.apiKey.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    await writeAuditLog({
      action: "api_key.revoke",
      actorUserId: session.user.id,
      organizationId: session.user.organizationId,
      meta: { id: existing.id, name: existing.name },
    });

    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
