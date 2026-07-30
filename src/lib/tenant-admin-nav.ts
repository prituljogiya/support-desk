export type TenantAdminNavId =
  | "dashboard"
  | "tickets-all"
  | "tickets-mine"
  | "tickets-unassigned"
  | "tickets-escalated"
  | "tickets-archived"
  | "omni-hub"
  | "omni-email"
  | "omni-whatsapp"
  | "customers"
  | "organizations"
  | "contacts"
  | "users"
  | "roles"
  | "knowledge"
  | "automation"
  | "reports"
  | "billing"
  | "settings-company"
  | "settings-hours"
  | "settings-sla"
  | "settings-branding"
  | "settings-email"
  | "settings-api"
  | "audit"
  | "profile"
  | "onboarding";

export type TenantNavItem = { id: TenantAdminNavId; label: string };
export type TenantNavGroup = {
  id: string;
  label: string;
  icon: string;
  items?: TenantNavItem[];
  href?: TenantAdminNavId;
};

/** Real omnichannel surfaces — hub is the single-click setup. */
export const TENANT_ADMIN_NAV: TenantNavGroup[] = [
  { id: "dashboard", label: "Dashboard", icon: "⌂", href: "dashboard" },
  { id: "onboarding", label: "Getting started", icon: "✓", href: "onboarding" },
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
    label: "Channels",
    icon: "📡",
    items: [
      { id: "omni-hub", label: "Connect channels" },
      { id: "omni-email", label: "Email" },
      { id: "omni-whatsapp", label: "WhatsApp" },
    ],
  },
  {
    id: "crm",
    label: "Customers",
    icon: "👥",
    items: [
      { id: "customers", label: "Customers" },
      { id: "organizations", label: "Companies" },
      { id: "contacts", label: "Contacts" },
    ],
  },
  {
    id: "team",
    label: "Team",
    icon: "👨‍💼",
    items: [
      { id: "users", label: "Users & invites" },
      { id: "roles", label: "Roles" },
    ],
  },
  { id: "knowledge", label: "Knowledge Base", icon: "📚", href: "knowledge" },
  { id: "automation", label: "Automation", icon: "⚙️", href: "automation" },
  { id: "reports", label: "Reports", icon: "📊", href: "reports" },
  { id: "billing", label: "Billing", icon: "🧾", href: "billing" },
  {
    id: "settings",
    label: "Settings",
    icon: "⚙️",
    items: [
      { id: "settings-company", label: "Company Profile" },
      { id: "settings-hours", label: "Business Hours" },
      { id: "settings-sla", label: "SLA Policies" },
      { id: "settings-branding", label: "Branding" },
      { id: "settings-email", label: "Email inbound" },
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
