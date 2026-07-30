import { prisma } from "@/lib/prisma";

export type AiConfig = {
  /**
   * builtin = SmartDesk's own AI (default, no third-party APIs)
   * self_hosted = optional OpenAI-compatible URL you run yourself (not required)
   * disabled = off
   */
  provider: "builtin" | "self_hosted" | "disabled";
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
};

const DEFAULTS: AiConfig = {
  provider: "builtin",
  baseUrl: "",
  apiKey: "",
  model: "smartdesk-builtin",
  systemPrompt:
    "You are SmartDesk built-in AI. Prefer the organization's knowledge base. Never invent account data.",
  temperature: 0.4,
  maxTokens: 800,
};

export function parseAiJson(raw: string | null | undefined): Partial<AiConfig> {
  try {
    return raw ? (JSON.parse(raw) as Partial<AiConfig>) : {};
  } catch {
    return {};
  }
}

function normalizeProvider(
  p: string | undefined,
): AiConfig["provider"] {
  if (p === "disabled") return "disabled";
  if (
    p === "self_hosted" ||
    p === "openai" ||
    p === "openai_compatible" ||
    p === "ollama"
  ) {
    // Legacy third-party modes → treat as optional self-hosted only
    return "self_hosted";
  }
  return "builtin";
}

export async function getAiConfig(): Promise<AiConfig> {
  const settings = await prisma.platformSetting.findUnique({
    where: { id: "default" },
  });
  const fromDb = parseAiJson(settings?.aiJson);
  const provider = normalizeProvider(fromDb.provider);

  return {
    ...DEFAULTS,
    ...fromDb,
    provider,
    baseUrl: fromDb.baseUrl || process.env.LLM_BASE_URL || "",
    apiKey:
      fromDb.apiKey ||
      process.env.LLM_API_KEY ||
      process.env.OPENAI_API_KEY ||
      "",
    model:
      provider === "builtin"
        ? "smartdesk-builtin"
        : fromDb.model || process.env.LLM_MODEL || "local-model",
    systemPrompt: fromDb.systemPrompt || DEFAULTS.systemPrompt,
    temperature:
      typeof fromDb.temperature === "number"
        ? fromDb.temperature
        : DEFAULTS.temperature,
    maxTokens:
      typeof fromDb.maxTokens === "number"
        ? fromDb.maxTokens
        : DEFAULTS.maxTokens,
  };
}

export function aiConfigured(cfg: AiConfig) {
  if (cfg.provider === "disabled") return false;
  if (cfg.provider === "builtin") return true;
  return Boolean(cfg.baseUrl && cfg.model);
}

/** Only used when provider is self_hosted (your machine / VPC). Never required. */
export async function chatCompletion(opts: {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  temperature?: number;
  maxTokens?: number;
}) {
  const cfg = await getAiConfig();
  if (cfg.provider !== "self_hosted" || !cfg.baseUrl) {
    throw new Error(
      "Self-hosted LLM is not enabled. SmartDesk uses built-in AI by default.",
    );
  }

  const base = cfg.baseUrl.replace(/\/$/, "");
  const url = `${base}/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: cfg.model,
      temperature: opts.temperature ?? cfg.temperature,
      max_tokens: opts.maxTokens ?? cfg.maxTokens,
      messages: opts.messages,
    }),
  });

  const raw = await res.text();
  let json: {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  try {
    json = JSON.parse(raw) as typeof json;
  } catch {
    throw new Error(`Self-hosted LLM non-JSON (${res.status}): ${raw.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(json.error?.message || `Self-hosted LLM failed (${res.status})`);
  }
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Self-hosted LLM returned empty content");
  return {
    content,
    model: cfg.model,
    provider: "self_hosted" as const,
    usage: json.usage || null,
  };
}

export async function logAiEvent(
  organizationId: string,
  type: string,
  meta: Record<string, unknown> = {},
) {
  try {
    await prisma.aiMetricEvent.create({
      data: {
        organizationId,
        type,
        meta: JSON.stringify(meta),
      },
    });
  } catch {
    /* ignore */
  }
}
