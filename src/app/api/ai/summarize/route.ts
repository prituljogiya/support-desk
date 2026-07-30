import { z } from "zod";
import { requireStaff, getOrgWithPlan } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { can } from "@/lib/features";
import { hasPermission } from "@/lib/permissions";
import { getAiConfig, aiConfigured, logAiEvent } from "@/lib/llm";
import { builtinSummarize } from "@/lib/local-ai";

const schema = z.object({
  ticketId: z.string().min(1),
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
    const result = await builtinSummarize({
      organizationId: org.id,
      ticketId: body.ticketId,
    });

    await logAiEvent(org.id, "summarize", {
      ticketId: body.ticketId,
      model: result.model,
    });

    return jsonOk(result);
  } catch (err) {
    return handleApiError(err);
  }
}
