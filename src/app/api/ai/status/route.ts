import { requireSuperAdmin } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { getAiConfig, aiConfigured, chatCompletion } from "@/lib/llm";

/** Super-admin: current AI config (key redacted) + optional ping. */
export async function GET(req: Request) {
  try {
    await requireSuperAdmin();
    const cfg = await getAiConfig();
    const { searchParams } = new URL(req.url);
    const ping = searchParams.get("ping") === "1";

    let pingResult: { ok: boolean; reply?: string; error?: string } | null =
      null;
    if (ping && aiConfigured(cfg)) {
      try {
        const r = await chatCompletion({
          messages: [
            { role: "system", content: "Reply with exactly: ok" },
            { role: "user", content: "ping" },
          ],
          maxTokens: 10,
          temperature: 0,
        });
        pingResult = { ok: true, reply: r.content };
      } catch (e) {
        pingResult = {
          ok: false,
          error: e instanceof Error ? e.message : "ping failed",
        };
      }
    }

    return jsonOk({
      config: {
        provider: cfg.provider,
        baseUrl: cfg.baseUrl,
        model: cfg.model,
        systemPrompt: cfg.systemPrompt,
        temperature: cfg.temperature,
        maxTokens: cfg.maxTokens,
        apiKeySet: Boolean(cfg.apiKey),
        configured: aiConfigured(cfg),
      },
      ping: pingResult,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
