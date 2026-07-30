import { z } from "zod";
import { requireStaff, getOrgWithPlan } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { can } from "@/lib/features";
import { hasPermission } from "@/lib/permissions";
import { getAiConfig, aiConfigured, logAiEvent } from "@/lib/llm";
import { builtinChat } from "@/lib/local-ai";

const schema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(12)
    .optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireStaff();
    if (
      !hasPermission(session.user.membershipRole, "ai.use", {
        isSuperAdmin: session.user.isSuperAdmin,
      })
    ) {
      return jsonError("AI permission required", 403);
    }

    const org = await getOrgWithPlan(session.user.organizationId);
    if (!org || !can(org, "aiAssistant")) {
      return jsonError("AI assistant is not on your plan", 402);
    }

    const cfg = await getAiConfig();
    if (!aiConfigured(cfg)) {
      return jsonError("AI is disabled", 503);
    }

    const body = schema.parse(await req.json());
    const result = await builtinChat({
      organizationId: org.id,
      message: body.message,
      history: body.history,
      userId: session.user.id,
      userName: session.user.name || "Agent",
      userEmail: session.user.email!,
      canCreateTicket: true,
    });

    await logAiEvent(org.id, result.ticket ? "chat_create_ticket" : "chat", {
      model: result.model,
      provider: "builtin",
      ticketId: result.ticket?.id,
    });

    return jsonOk(result);
  } catch (err) {
    return handleApiError(err);
  }
}
