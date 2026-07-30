import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff, getOrgWithPlan } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { can } from "@/lib/features";
import { chatCompletion, getAiConfig, aiConfigured, logAiEvent } from "@/lib/llm";
import { hasPermission } from "@/lib/permissions";

const schema = z.object({
  ticketId: z.string().min(1),
  tone: z.enum(["friendly", "formal", "brief"]).optional().default("friendly"),
});

export async function POST(req: Request) {
  try {
    const session = await requireStaff();
    if (!hasPermission(session.user.membershipRole, "ai.use", {
      isSuperAdmin: session.user.isSuperAdmin,
    })) {
      return jsonError("AI permission required", 403);
    }

    const org = await getOrgWithPlan(session.user.organizationId);
    if (!org || !can(org, "aiAssistant")) {
      return jsonError("AI assistant is not on your plan", 402);
    }

    const cfg = await getAiConfig();
    if (!aiConfigured(cfg)) {
      return jsonError(
        "AI model not configured. Super admin: set Platform AI (OpenAI-compatible URL + model + key), or env LLM_BASE_URL / LLM_API_KEY / LLM_MODEL.",
        503,
      );
    }

    const body = schema.parse(await req.json());
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: body.ticketId,
        organizationId: session.user.organizationId,
      },
      include: {
        messages: {
          where: { isInternal: false },
          orderBy: { createdAt: "asc" },
          take: 20,
          include: { author: { select: { name: true } } },
        },
        contact: { select: { name: true } },
      },
    });
    if (!ticket) return jsonError("Ticket not found", 404);

    const thread = ticket.messages
      .map((m) => `${m.author.name}: ${m.body}`)
      .join("\n\n");

    const toneHint =
      body.tone === "formal"
        ? "Use a formal professional tone."
        : body.tone === "brief"
          ? "Keep the reply under 80 words."
          : "Use a warm, friendly professional tone.";

    const result = await chatCompletion({
      messages: [
        {
          role: "system",
          content: `${cfg.systemPrompt}\n\n${toneHint}\nReply as the support agent only — output the customer-facing message, no preamble.`,
        },
        {
          role: "user",
          content: `Channel: ${ticket.channel}
Subject: ${ticket.subject}
Customer: ${ticket.contact?.name || "Customer"}
Description: ${ticket.description}

Conversation:
${thread || "(no messages yet)"}

Draft the next support reply.`,
        },
      ],
    });

    await logAiEvent(org.id, "suggest_reply", {
      ticketId: ticket.id,
      model: result.model,
      usage: result.usage,
    });

    return jsonOk({
      reply: result.content,
      model: result.model,
      provider: result.provider,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
