import { requireSuperAdmin } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { getAiConfig, aiConfigured } from "@/lib/llm";

/** Super-admin: current AI config. Built-in is always ready. */
export async function GET() {
  try {
    await requireSuperAdmin();
    const cfg = await getAiConfig();

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
        mode:
          cfg.provider === "builtin"
            ? "SmartDesk built-in AI (no third-party APIs)"
            : cfg.provider === "self_hosted"
              ? "Optional self-hosted endpoint"
              : "Disabled",
      },
      ping:
        cfg.provider === "builtin"
          ? { ok: true, reply: "ok · builtin" }
          : null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
