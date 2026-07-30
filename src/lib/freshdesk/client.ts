import { prisma } from "@/lib/prisma";

export type FreshdeskTicketPayload = {
  subject: string;
  description: string;
  email: string;
  status: number;
  priority: number;
  name?: string;
};

export type FreshdeskTicket = {
  id: number;
  subject: string;
  description_text?: string;
  description?: string;
  status: number;
  priority: number;
  requester_id?: number;
  email?: string;
  created_at?: string;
  updated_at?: string;
};

export type FreshdeskConversation = {
  id: number;
  body_text?: string;
  body?: string;
  incoming?: boolean;
  private?: boolean;
  user_id?: number;
  created_at?: string;
};

export type FreshdeskConfig = {
  domain: string;
  apiKey: string;
};

export function isFreshdeskConfigured(): boolean {
  return Boolean(
    process.env.FRESHDESK_DOMAIN?.trim() &&
      process.env.FRESHDESK_API_KEY?.trim(),
  );
}

export async function getFreshdeskConfigForOrg(
  organizationId: string,
): Promise<FreshdeskConfig | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      freshdeskDomain: true,
      freshdeskApiKey: true,
      plan: { select: { features: true } },
    },
  });

  if (org?.freshdeskDomain?.trim() && org.freshdeskApiKey?.trim()) {
    return {
      domain: org.freshdeskDomain
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, ""),
      apiKey: org.freshdeskApiKey.trim(),
    };
  }

  if (isFreshdeskConfigured()) {
    return {
      domain: process.env
        .FRESHDESK_DOMAIN!.trim()
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, ""),
      apiKey: process.env.FRESHDESK_API_KEY!.trim(),
    };
  }

  return null;
}

export async function isFreshdeskConfiguredForOrg(organizationId: string) {
  return Boolean(await getFreshdeskConfigForOrg(organizationId));
}

function getEnvConfig(): FreshdeskConfig {
  const domain = process.env.FRESHDESK_DOMAIN?.trim();
  const apiKey = process.env.FRESHDESK_API_KEY?.trim();
  if (!domain || !apiKey) {
    throw new Error("Freshdesk is not configured");
  }
  return {
    domain: domain.replace(/^https?:\/\//, "").replace(/\/$/, ""),
    apiKey,
  };
}

async function freshdeskFetch<T>(
  path: string,
  init?: RequestInit,
  config?: FreshdeskConfig | null,
): Promise<T> {
  const { domain, apiKey } = config ?? getEnvConfig();
  const auth = Buffer.from(`${apiKey}:X`).toString("base64");
  const res = await fetch(`https://${domain}/api/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Freshdesk ${res.status}: ${text || res.statusText}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export function createFreshdeskClient(config?: FreshdeskConfig | null) {
  return {
    createTicket(payload: FreshdeskTicketPayload) {
      return freshdeskFetch<FreshdeskTicket>(
        "/tickets",
        { method: "POST", body: JSON.stringify(payload) },
        config,
      );
    },

    updateTicket(
      id: number,
      payload: Partial<
        Pick<
          FreshdeskTicketPayload,
          "subject" | "description" | "status" | "priority"
        >
      >,
    ) {
      return freshdeskFetch<FreshdeskTicket>(
        `/tickets/${id}`,
        { method: "PUT", body: JSON.stringify(payload) },
        config,
      );
    },

    getTicket(id: number) {
      return freshdeskFetch<FreshdeskTicket>(`/tickets/${id}`, undefined, config);
    },

    listTickets(updatedSince?: string) {
      const params = new URLSearchParams({
        per_page: "30",
        order_by: "updated_at",
        order_type: "desc",
      });
      if (updatedSince) {
        return freshdeskFetch<FreshdeskTicket[]>(
          `/search/tickets?query=${encodeURIComponent(`updated_at:>'${updatedSince}'`)}`,
          undefined,
          config,
        ).then((data) => {
          if (Array.isArray(data)) return data;
          const wrapped = data as unknown as { results?: FreshdeskTicket[] };
          return wrapped.results ?? [];
        });
      }
      return freshdeskFetch<FreshdeskTicket[]>(
        `/tickets?${params.toString()}`,
        undefined,
        config,
      );
    },

    createReply(ticketId: number, body: string) {
      return freshdeskFetch<FreshdeskConversation>(
        `/tickets/${ticketId}/reply`,
        { method: "POST", body: JSON.stringify({ body }) },
        config,
      );
    },

    createNote(ticketId: number, body: string, isPrivate = true) {
      return freshdeskFetch<FreshdeskConversation>(
        `/tickets/${ticketId}/notes`,
        {
          method: "POST",
          body: JSON.stringify({ body, private: isPrivate }),
        },
        config,
      );
    },

    listConversations(ticketId: number) {
      return freshdeskFetch<FreshdeskConversation[]>(
        `/tickets/${ticketId}/conversations`,
        undefined,
        config,
      );
    },
  };
}

/** Env-level client for backwards compatibility */
export const freshdeskClient = createFreshdeskClient();
