import type { Organization, Plan } from "@prisma/client";
import {
  hasPermission,
  isDeskRole,
  isPortalRole,
  isSeatRole,
  type Permission,
} from "@/lib/permissions";

export type PlanFeatures = {
  sla: boolean;
  macros: boolean;
  cannedResponses: boolean;
  freshdeskSync: boolean;
  savedViews: boolean;
  contacts: boolean;
  knowledge: boolean;
  automation: boolean;
  export: boolean;
  aiAssistant: boolean;
  liveChat: boolean;
  whatsapp: boolean;
  assetManagement: boolean;
  analytics: boolean;
  whiteLabel: boolean;
  sso: boolean;
};

export type FeatureKey = keyof PlanFeatures;

export const DEFAULT_FEATURES: PlanFeatures = {
  sla: false,
  macros: false,
  cannedResponses: true,
  freshdeskSync: false,
  savedViews: true,
  contacts: true,
  knowledge: true,
  automation: false,
  export: true,
  aiAssistant: false,
  liveChat: false,
  whatsapp: false,
  assetManagement: false,
  analytics: true,
  whiteLabel: false,
  sso: false,
};

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  sla: "SLA",
  macros: "Macros",
  cannedResponses: "Canned responses",
  freshdeskSync: "Freshdesk sync",
  savedViews: "Saved views",
  contacts: "Contacts CRM",
  knowledge: "Knowledge Base",
  automation: "Automation",
  export: "Export",
  aiAssistant: "AI Assistant",
  liveChat: "Live Chat",
  whatsapp: "WhatsApp",
  assetManagement: "Asset Management",
  analytics: "Analytics",
  whiteLabel: "White Label",
  sso: "SSO",
};

export function parsePlanFeatures(raw: string | null | undefined): PlanFeatures {
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<PlanFeatures>) : {};
    return { ...DEFAULT_FEATURES, ...parsed };
  } catch {
    return { ...DEFAULT_FEATURES };
  }
}

export function can(
  org: { plan?: Plan | null } | (Organization & { plan?: Plan | null }),
  feature: FeatureKey,
): boolean {
  const plan = "plan" in org ? org.plan : null;
  if (!plan) return DEFAULT_FEATURES[feature];
  return parsePlanFeatures(plan.features)[feature];
}

/** Desk-capable roles (managers, agents, auditors, etc.) */
export function isStaffRole(role: string | null | undefined) {
  return isDeskRole(role as never);
}

export function isOrgAdminRole(role: string | null | undefined) {
  return (
    hasPermission(role as never, "users.assign_roles") ||
    hasPermission(role as never, "settings.manage")
  );
}

export function roleCan(
  role: string | null | undefined,
  permission: Permission,
  isSuperAdmin?: boolean,
) {
  return hasPermission(role as never, permission, { isSuperAdmin });
}

export { isDeskRole, isPortalRole, isSeatRole };

export function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "org"
  );
}
