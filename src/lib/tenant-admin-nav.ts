export type TenantAdminNavId =
  | "dashboard"
  | "tickets-all"
  | "tickets-mine"
  | "tickets-unassigned"
  | "tickets-escalated"
  | "tickets-archived"
  | "omni-email"
  | "omni-chat"
  | "omni-whatsapp"
  | "omni-social"
  | "customers"
  | "organizations"
  | "contacts"
  | "users"
  | "departments"
  | "teams"
  | "roles"
  | "ai-copilot"
  | "ai-analytics"
  | "ai-prompts"
  | "knowledge"
  | "automation"
  | "reports"
  | "integrations"
  | "notifications"
  | "billing"
  | "settings-company"
  | "settings-hours"
  | "settings-sla"
  | "settings-branding"
  | "settings-email"
  | "settings-api"
  | "audit"
  | "profile";

export type TenantNavItem = { id: TenantAdminNavId; label: string };
export type TenantNavGroup = {
  id: string;
  label: string;
  icon: string;
  items?: TenantNavItem[];
  href?: TenantAdminNavId;
};

export const TENANT_ADMIN_NAV: TenantNavGroup[] = [
  { id: "dashboard", label: "Dashboard", icon: "⌂", href: "dashboard" },
  {
    id: "tickets",
    label: "Tickets",
    icon: "🎫",
    items: [
      { id: "tickets-all", label: "All Tickets" },
      { id: "tickets-mine", label: "My Tickets" },
      { id: "tickets-unassigned", label: "Unassigned" },
      { id: "tickets-escalated", label: "Escalated" },
      { id: "tickets-archived", label: "Archived" },
    ],
  },
  {
    id: "omni",
    label: "Omnichannel",
    icon: "💬",
    items: [
      { id: "omni-email", label: "Email" },
      { id: "omni-chat", label: "Live Chat" },
      { id: "omni-whatsapp", label: "WhatsApp" },
      { id: "omni-social", label: "Social Media" },
    ],
  },
  {
    id: "crm",
    label: "Customers",
    icon: "👥",
    items: [
      { id: "customers", label: "Customers" },
      { id: "organizations", label: "Organizations" },
      { id: "contacts", label: "Contacts" },
    ],
  },
  {
    id: "team",
    label: "Team",
    icon: "👨‍💼",
    items: [
      { id: "users", label: "Users" },
      { id: "departments", label: "Departments" },
      { id: "teams", label: "Teams" },
      { id: "roles", label: "Roles & Permissions" },
    ],
  },
  {
    id: "ai",
    label: "AI Center",
    icon: "🤖",
    items: [
      { id: "ai-copilot", label: "AI Copilot" },
      { id: "ai-analytics", label: "AI Analytics" },
      { id: "ai-prompts", label: "Prompt Settings" },
    ],
  },
  { id: "knowledge", label: "Knowledge Base", icon: "📚", href: "knowledge" },
  { id: "automation", label: "Automation", icon: "⚙️", href: "automation" },
  { id: "reports", label: "Reports & Analytics", icon: "📊", href: "reports" },
  { id: "integrations", label: "Integrations", icon: "🔗", href: "integrations" },
  { id: "notifications", label: "Notifications", icon: "🔔", href: "notifications" },
  { id: "billing", label: "Billing & Subscription", icon: "🧾", href: "billing" },
  {
    id: "settings",
    label: "Settings",
    icon: "⚙️",
    items: [
      { id: "settings-company", label: "Company Profile" },
      { id: "settings-hours", label: "Business Hours" },
      { id: "settings-sla", label: "SLA Policies" },
      { id: "settings-branding", label: "Branding" },
      { id: "settings-email", label: "Email Settings" },
      { id: "settings-api", label: "API Keys" },
    ],
  },
  { id: "audit", label: "Audit Logs", icon: "📜", href: "audit" },
  { id: "profile", label: "Profile", icon: "👤", href: "profile" },
];

export function tenantNavLabel(id: TenantAdminNavId) {
  for (const g of TENANT_ADMIN_NAV) {
    if (g.href === id) return g.label;
    const hit = g.items?.find((i) => i.id === id);
    if (hit) return hit.label;
  }
  return id;
}
