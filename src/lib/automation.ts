import { prisma } from "@/lib/prisma";

export async function notifyUser(input: {
  organizationId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
}) {
  return prisma.notification.create({ data: input });
}

export async function runTicketAutomations(input: {
  organizationId: string;
  ticketId: string;
  subject: string;
  description: string;
  priority: string;
}) {
  const rules = await prisma.automationRule.findMany({
    where: { organizationId: input.organizationId, enabled: true },
  });
  if (!rules.length) return;

  const hay = `${input.subject} ${input.description}`.toLowerCase();

  for (const rule of rules) {
    let match: {
      keywords?: string[];
      priority?: string;
    } = {};
    let actions: {
      assigneeId?: string | null;
      addTagIds?: string[];
      setPriority?: string;
    } = {};
    try {
      match = JSON.parse(rule.match) as typeof match;
      actions = JSON.parse(rule.actions) as typeof actions;
    } catch {
      continue;
    }

    if (match.priority && match.priority !== input.priority) continue;
    if (match.keywords?.length) {
      const hit = match.keywords.some((k) =>
        hay.includes(k.toLowerCase().trim()),
      );
      if (!hit) continue;
    }

    const data: {
      assigneeId?: string | null;
      priority?: "low" | "medium" | "high" | "urgent";
    } = {};
    if (actions.assigneeId) data.assigneeId = actions.assigneeId;
    if (
      actions.setPriority &&
      ["low", "medium", "high", "urgent"].includes(actions.setPriority)
    ) {
      data.priority = actions.setPriority as
        | "low"
        | "medium"
        | "high"
        | "urgent";
    }
    if (Object.keys(data).length) {
      await prisma.ticket.update({
        where: { id: input.ticketId },
        data,
      });
    }
    if (actions.addTagIds?.length) {
      for (const tagId of actions.addTagIds) {
        const tag = await prisma.tag.findFirst({
          where: { id: tagId, organizationId: input.organizationId },
        });
        if (!tag) continue;
        await prisma.ticketTag.upsert({
          where: {
            ticketId_tagId: { ticketId: input.ticketId, tagId },
          },
          update: {},
          create: { ticketId: input.ticketId, tagId },
        });
      }
    }

    if (actions.assigneeId) {
      await notifyUser({
        organizationId: input.organizationId,
        userId: actions.assigneeId,
        type: "ticket_assigned",
        title: "Ticket auto-assigned",
        body: input.subject,
        link: `/desk/tickets/${input.ticketId}`,
      });
    }

    await prisma.automationRun.create({
      data: {
        organizationId: input.organizationId,
        ruleId: rule.id,
        ticketId: input.ticketId,
        success: true,
        detail: rule.name,
      },
    });
    await prisma.aiMetricEvent.create({
      data: {
        organizationId: input.organizationId,
        type: "auto_assign",
        meta: JSON.stringify({ ruleId: rule.id, ticketId: input.ticketId }),
      },
    });
  }
}
