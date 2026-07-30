import type { MembershipRole } from "@prisma/client";

/** Granular permission keys used across desk + platform */
export const PERMISSIONS = [
  "tickets.view",
  "tickets.view_assigned",
  "tickets.view_team",
  "tickets.view_company",
  "tickets.create",
  "tickets.edit",
  "tickets.delete",
  "tickets.assign",
  "tickets.merge",
  "tickets.split",
  "tickets.escalate",
  "tickets.close",
  "tickets.reopen",
  "tickets.approve_close",
  "tickets.export",
  "tickets.reply",
  "tickets.internal_note",
  "tickets.attach",
  "tickets.qa_review",
  "tickets.qa_score",
  "tickets.close_high_priority",
  "agents.view",
  "agents.monitor",
  "agents.manage",
  "users.view",
  "users.create",
  "users.edit",
  "users.delete",
  "users.assign_roles",
  "users.reset_password",
  "users.disable",
  "users.invite",
  "departments.manage",
  "teams.manage",
  "sla.view",
  "sla.configure",
  "sla.override",
  "automation.view",
  "automation.manage",
  "knowledge.view",
  "knowledge.edit",
  "knowledge.publish",
  "knowledge.archive",
  "reports.view",
  "reports.team",
  "reports.company",
  "reports.qa",
  "reports.export",
  "integrations.manage",
  "channels.view",
  "channels.manage",
  "branding.manage",
  "billing.view",
  "billing.manage",
  "ai.use",
  "ai.manage",
  "api.keys",
  "api.webhooks",
  "api.logs",
  "audit.view",
  "settings.manage",
  "permissions.manage",
  "desk.access",
  "portal.access",
  "dashboard.team",
  "dashboard.company",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ALL_PERMISSIONS = [...PERMISSIONS] as Permission[];

const TICKET_OPS: Permission[] = [
  "tickets.view",
  "tickets.create",
  "tickets.edit",
  "tickets.assign",
  "tickets.merge",
  "tickets.split",
  "tickets.escalate",
  "tickets.close",
  "tickets.reopen",
  "tickets.export",
  "tickets.reply",
  "tickets.internal_note",
  "tickets.attach",
  "tickets.close_high_priority",
  "ai.use",
];

const TENANT_ADMIN: Permission[] = [
  ...ALL_PERMISSIONS.filter((p) => p !== "portal.access"),
  "desk.access",
  "dashboard.company",
];

/** Role → permissions. Super admin is handled via User.isSuperAdmin. */
export const ROLE_PERMISSIONS: Record<MembershipRole, Permission[]> = {
  owner: TENANT_ADMIN,
  admin: TENANT_ADMIN,
  manager: [
    "desk.access",
    "dashboard.team",
    "tickets.view",
    "tickets.create",
    "tickets.edit",
    "tickets.assign",
    "tickets.merge",
    "tickets.split",
    "tickets.escalate",
    "tickets.close",
    "tickets.reopen",
    "tickets.export",
    "tickets.reply",
    "tickets.internal_note",
    "tickets.attach",
    "tickets.close_high_priority",
    "agents.view",
    "agents.monitor",
    "sla.view",
    "sla.override",
    "knowledge.view",
    "knowledge.edit",
    "knowledge.publish",
    "reports.view",
    "reports.team",
    "ai.use",
    "channels.view",
    "channels.manage",
  ],
  supervisor: [
    "desk.access",
    "dashboard.team",
    "tickets.view_team",
    "tickets.view",
    "tickets.assign",
    "tickets.escalate",
    "tickets.approve_close",
    "tickets.reply",
    "tickets.internal_note",
    "tickets.attach",
    "tickets.close",
    "agents.monitor",
    "reports.team",
    "sla.view",
    "ai.use",
  ],
  agent: [
    "desk.access",
    "tickets.view_assigned",
    "tickets.view",
    "tickets.reply",
    "tickets.internal_note",
    "tickets.edit",
    "tickets.close",
    "tickets.attach",
    "tickets.close_high_priority",
    "knowledge.view",
    "ai.use",
    "reports.view",
    "channels.view",
  ],
  junior_agent: [
    "desk.access",
    "tickets.view_assigned",
    "tickets.reply",
    "tickets.internal_note",
    "tickets.attach",
    "knowledge.view",
    "ai.use",
  ],
  qa: [
    "desk.access",
    "tickets.view",
    "tickets.qa_review",
    "tickets.qa_score",
    "tickets.internal_note",
    "reports.qa",
    "reports.view",
    "agents.view",
  ],
  customer: [
    "portal.access",
    "tickets.create",
    "tickets.view",
    "tickets.reply",
    "tickets.close",
    "tickets.attach",
    "knowledge.view",
  ],
  customer_manager: [
    "portal.access",
    "tickets.view_company",
    "tickets.create",
    "tickets.reply",
    "tickets.export",
    "tickets.attach",
    "users.invite",
    "knowledge.view",
  ],
  billing_manager: [
    "desk.access",
    "billing.view",
    "billing.manage",
    "reports.view",
  ],
  kb_editor: [
    "desk.access",
    "knowledge.view",
    "knowledge.edit",
    "knowledge.publish",
    "knowledge.archive",
  ],
  ai_manager: [
    "desk.access",
    "ai.use",
    "ai.manage",
    "knowledge.view",
    "knowledge.edit",
    "reports.view",
  ],
  developer: [
    "desk.access",
    "api.keys",
    "api.webhooks",
    "api.logs",
    "integrations.manage",
    "channels.view",
    "channels.manage",
    "audit.view",
  ],
  auditor: [
    "desk.access",
    "tickets.view",
    "reports.view",
    "reports.company",
    "audit.view",
    "sla.view",
    "agents.view",
    "users.view",
  ],
  guest: [
    "portal.access",
    "tickets.view",
    "tickets.reply",
    "knowledge.view",
  ],
};

export const ROLE_LABELS: Record<MembershipRole, string> = {
  owner: "Tenant Owner",
  admin: "Tenant Admin",
  manager: "Helpdesk Manager",
  supervisor: "Team Lead / Supervisor",
  agent: "Support Agent",
  junior_agent: "Junior Support Agent",
  qa: "QA / Quality Analyst",
  customer: "Customer",
  customer_manager: "Customer Manager",
  billing_manager: "Billing Manager",
  kb_editor: "Knowledge Base Editor",
  ai_manager: "AI Manager",
  developer: "Developer / API User",
  auditor: "Auditor",
  guest: "Guest",
};

/** Roles that may be invited by tenant admins */
export const INVITABLE_ROLES: MembershipRole[] = [
  "admin",
  "manager",
  "supervisor",
  "agent",
  "junior_agent",
  "qa",
  "customer",
  "customer_manager",
  "billing_manager",
  "kb_editor",
  "ai_manager",
  "developer",
  "auditor",
  "guest",
];

export function permissionsForRole(
  role: MembershipRole | null | undefined,
): Set<Permission> {
  if (!role) return new Set();
  return new Set(ROLE_PERMISSIONS[role] ?? []);
}

export function hasPermission(
  role: MembershipRole | null | undefined,
  permission: Permission,
  opts?: { isSuperAdmin?: boolean },
): boolean {
  if (opts?.isSuperAdmin) return true;
  return permissionsForRole(role).has(permission);
}

export function hasAnyPermission(
  role: MembershipRole | null | undefined,
  permissions: Permission[],
  opts?: { isSuperAdmin?: boolean },
): boolean {
  if (opts?.isSuperAdmin) return true;
  const set = permissionsForRole(role);
  return permissions.some((p) => set.has(p));
}

export function isDeskRole(role: MembershipRole | null | undefined) {
  return hasPermission(role, "desk.access");
}

export function isPortalRole(role: MembershipRole | null | undefined) {
  return hasPermission(role, "portal.access") && !hasPermission(role, "desk.access");
}

/** Staff seats count toward plan seat limits */
export function isSeatRole(role: MembershipRole | null | undefined) {
  return (
    role === "owner" ||
    role === "admin" ||
    role === "manager" ||
    role === "supervisor" ||
    role === "agent" ||
    role === "junior_agent" ||
    role === "qa" ||
    role === "kb_editor" ||
    role === "ai_manager" ||
    role === "developer" ||
    role === "auditor" ||
    role === "billing_manager"
  );
}

export function homeForRole(
  role: MembershipRole | null | undefined,
  isSuperAdmin?: boolean,
) {
  if (isSuperAdmin && !role) return "/platform";
  if (isPortalRole(role)) return "/portal";
  if (isDeskRole(role)) return "/desk";
  return "/portal";
}

/** Roles that can be assigned tickets / appear in agent pickers */
export const ASSIGNABLE_ROLES: MembershipRole[] = [
  "owner",
  "admin",
  "manager",
  "supervisor",
  "agent",
  "junior_agent",
];

