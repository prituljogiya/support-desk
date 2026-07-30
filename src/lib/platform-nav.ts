export type PlatformNavId =
  | "overview"
  | "analytics"
  | "ai-insights"
  | "companies"
  | "domains"
  | "storage"
  | "usage"
  | "plans"
  | "billing"
  | "invoices"
  | "coupons"
  | "users"
  | "roles"
  | "permissions"
  | "revenue"
  | "growth"
  | "churn"
  | "usage-report"
  | "ai-usage"
  | "ai-prompts"
  | "ai-models"
  | "ai-costs"
  | "email"
  | "sms"
  | "whatsapp"
  | "api"
  | "integrations"
  | "audit"
  | "sessions"
  | "ip"
  | "backups"
  | "restore"
  | "notifications"
  | "support"
  | "profile"
  | "health"
  | "features"
  | "reports";

export type PlatformNavItem = {
  id: PlatformNavId;
  label: string;
};

export type PlatformNavGroup = {
  id: string;
  label: string;
  icon: string;
  items: PlatformNavItem[];
};

export const PLATFORM_NAV: PlatformNavGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "⌂",
    items: [
      { id: "overview", label: "Overview" },
      { id: "analytics", label: "Analytics" },
      { id: "ai-insights", label: "AI Insights" },
    ],
  },
  {
    id: "tenants",
    label: "Tenant Management",
    icon: "▦",
    items: [
      { id: "companies", label: "Companies" },
      { id: "domains", label: "Domains" },
      { id: "storage", label: "Storage" },
      { id: "usage", label: "Usage" },
    ],
  },
  {
    id: "subscription",
    label: "Subscription",
    icon: "◈",
    items: [
      { id: "plans", label: "Plans" },
      { id: "billing", label: "Billing" },
      { id: "invoices", label: "Invoices" },
      { id: "coupons", label: "Coupons" },
    ],
  },
  {
    id: "users",
    label: "User Management",
    icon: "☺",
    items: [
      { id: "users", label: "Users" },
      { id: "roles", label: "Roles" },
      { id: "permissions", label: "Permissions" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: "▣",
    items: [
      { id: "revenue", label: "Revenue" },
      { id: "growth", label: "Growth" },
      { id: "churn", label: "Churn" },
      { id: "usage-report", label: "Usage" },
    ],
  },
  {
    id: "ai",
    label: "AI Center",
    icon: "✦",
    items: [
      { id: "ai-usage", label: "AI Usage" },
      { id: "ai-prompts", label: "Prompts" },
      { id: "ai-models", label: "Models" },
      { id: "ai-costs", label: "Costs" },
    ],
  },
  {
    id: "platform",
    label: "Platform",
    icon: "⚙",
    items: [
      { id: "email", label: "Email" },
      { id: "sms", label: "SMS" },
      { id: "whatsapp", label: "WhatsApp" },
      { id: "api", label: "API" },
      { id: "integrations", label: "Integrations" },
      { id: "health", label: "Health" },
      { id: "features", label: "Features" },
    ],
  },
  {
    id: "security",
    label: "Security",
    icon: "⛨",
    items: [
      { id: "audit", label: "Audit Logs" },
      { id: "sessions", label: "Sessions" },
      { id: "ip", label: "IP Management" },
    ],
  },
  {
    id: "backup",
    label: "Backup",
    icon: "⇩",
    items: [
      { id: "backups", label: "Backups" },
      { id: "restore", label: "Restore" },
    ],
  },
];

export const PLATFORM_FOOTER_NAV: PlatformNavItem[] = [
  { id: "notifications", label: "Notifications" },
  { id: "support", label: "Support Center" },
  { id: "profile", label: "Profile" },
];

export function labelForNav(id: PlatformNavId) {
  for (const g of PLATFORM_NAV) {
    const hit = g.items.find((i) => i.id === id);
    if (hit) return hit.label;
  }
  return PLATFORM_FOOTER_NAV.find((i) => i.id === id)?.label || id;
}
