import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff, getOrgWithPlan } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { can } from "@/lib/features";
import { chatCompletion, getAiConfig, aiConfigured, logAiEvent } from "@/lib/llm";
import { hasPermission } from "@/lib/permissions";

const schema = z.object({
  ticketId: z.string().min(1),
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
      return jsonError("AI model not configured", 503);
    }

    const body = schema.parse(await req.json());
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: body.ticketId,
        organizationId: session.user.organizationId,
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 30,
          include: { author: { select: { name: true } } },
        },
      },
    });
    if (!ticket) return jsonError("Ticket not found", 404);

    const thread = ticket.messages
      .map(
        (m) =>
          `${m.isInternal ? "[internal] " : ""}${m.author.name}: ${m.body}`,
      )
      .join("\n");

    const result = await chatCompletion({
      messages: [
        {
          role: "system",
          content:
            "Summarize this support ticket for an agent. Output: 1) Issue (1-2 sentences) 2) Status 3) Suggested next step. Be factual.",
        },
        {
          role: "user",
          content: `Subject: ${ticket.subject}\nPriority: ${ticket.priority}\nStatus: ${ticket.status}\n\n${ticket.description}\n\n${thread}`,
        },
      ],
      maxTokens: 400,
    });

    await logAiEvent(org.id, "summarize", {
      ticketId: ticket.id,
      model: result.model,
    });

    return jsonOk({
      summary: result.content,
      model: result.model,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
