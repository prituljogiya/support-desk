import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { getAiConfig, parseAiJson } from "@/lib/llm";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  provider: z.enum(["builtin", "self_hosted", "disabled"]).optional(),
  baseUrl: z.string().max(500).optional(),
  apiKey: z.string().max(500).optional(),
  model: z.string().max(200).optional(),
  systemPrompt: z.string().max(4000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(50).max(4000).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSuperAdmin();
    const body = schema.parse(await req.json());
    const current = await getAiConfig();
    const settings = await prisma.platformSetting.findUnique({
      where: { id: "default" },
    });
    const prev = parseAiJson(settings?.aiJson);

    const next = {
      provider: body.provider ?? "builtin",
      baseUrl: body.baseUrl ?? current.baseUrl,
      model:
        (body.provider ?? current.provider) === "builtin"
          ? "smartdesk-builtin"
          : body.model ?? current.model,
      systemPrompt: body.systemPrompt ?? current.systemPrompt,
      temperature: body.temperature ?? current.temperature,
      maxTokens: body.maxTokens ?? current.maxTokens,
      apiKey:
        body.apiKey && body.apiKey.trim()
          ? body.apiKey.trim()
          : prev.apiKey || "",
    };

    await prisma.platformSetting.upsert({
      where: { id: "default" },
      update: { aiJson: JSON.stringify(next) },
      create: { id: "default", aiJson: JSON.stringify(next) },
    });

    await writeAuditLog({
      action: "platform.ai.config",
      actorUserId: session.user.id,
      meta: { provider: next.provider, model: next.model },
    });

    return jsonOk({
      ok: true,
      config: {
        ...next,
        apiKey: undefined,
        apiKeySet: Boolean(next.apiKey),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
