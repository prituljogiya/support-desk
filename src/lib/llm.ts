import { prisma } from "@/lib/prisma";

export type AiConfig = {
  /** openai | openai_compatible | ollama | disabled */
  provider: "openai" | "openai_compatible" | "ollama" | "disabled";
  /** e.g. https://api.openai.com/v1 or http://localhost:11434/v1 */
  baseUrl: string;
  apiKey: string;
  /** Model id — gpt-4o-mini, llama3.2, your fine-tuned name, etc. */
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
};

const DEFAULTS: AiConfig = {
  provider: "disabled",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  systemPrompt:
    "You are a helpful customer support agent. Be concise, empathetic, and accurate. Never invent account data.",
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

export async function getAiConfig(): Promise<AiConfig> {
  const settings = await prisma.platformSetting.findUnique({
    where: { id: "default" },
  });
  const fromDb = parseAiJson(settings?.aiJson);

  const provider =
    fromDb.provider ||
    (process.env.OPENAI_API_KEY || process.env.LLM_API_KEY
      ? "openai_compatible"
      : "disabled");

  return {
    ...DEFAULTS,
    ...fromDb,
    provider: provider as AiConfig["provider"],
    baseUrl:
      fromDb.baseUrl ||
      process.env.LLM_BASE_URL ||
      process.env.OPENAI_BASE_URL ||
      DEFAULTS.baseUrl,
    apiKey:
      fromDb.apiKey ||
      process.env.LLM_API_KEY ||
      process.env.OPENAI_API_KEY ||
      "",
    model: fromDb.model || process.env.LLM_MODEL || DEFAULTS.model,
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
  // Ollama often needs no key
  if (cfg.provider === "ollama") return Boolean(cfg.baseUrl && cfg.model);
  return Boolean(cfg.baseUrl && cfg.model && cfg.apiKey);
}

export async function chatCompletion(opts: {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  temperature?: number;
  maxTokens?: number;
}) {
  const cfg = await getAiConfig();
  if (!aiConfigured(cfg)) {
    throw new Error(
      "AI is not configured. Set Platform → AI (base URL, model, API key) or LLM_BASE_URL / LLM_API_KEY / LLM_MODEL env.",
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
    throw new Error(`LLM returned non-JSON (${res.status}): ${raw.slice(0, 200)}`);
  }

  if (!res.ok) {
    throw new Error(
      json.error?.message || `LLM request failed (${res.status})`,
    );
  }

  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("LLM returned empty content");

  return {
    content,
    model: cfg.model,
    provider: cfg.provider,
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
    /* ignore metric failures */
  }
}
