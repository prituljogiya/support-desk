/** Shared industry list + sector packs so SmartDesk works across verticals. */

export const INDUSTRIES = [
  "SaaS",
  "E-commerce",
  "FinTech",
  "Healthcare",
  "Education",
  "Agency",
  "Retail",
  "Manufacturing",
  "Hospitality",
  "Logistics",
  "Real Estate",
  "Telecom",
  "Government",
  "Nonprofit",
  "Other",
] as const;

export type IndustryKey = (typeof INDUSTRIES)[number];

export type SectorPack = {
  key: IndustryKey;
  tagline: string;
  departments: string[];
  tags: { name: string; color: string }[];
  canned: { title: string; body: string }[];
  /** Default SLA minutes */
  firstResponseMinutes: number;
  resolutionMinutes: number;
  sampleSubjects: string[];
};

const DEFAULT_PACK: Omit<SectorPack, "key" | "tagline"> = {
  departments: ["general", "billing", "technical", "sales"],
  tags: [
    { name: "urgent", color: "#e11d48" },
    { name: "billing", color: "#0369a1" },
    { name: "howto", color: "#0f766e" },
  ],
  canned: [
    {
      title: "Thanks — we're on it",
      body: "Thanks for reaching out. We've received your request and a teammate will reply shortly.",
    },
    {
      title: "Need more detail",
      body: "Thanks for contacting us. Could you share a bit more detail (steps to reproduce, screenshots, or order/account ID) so we can help faster?",
    },
  ],
  firstResponseMinutes: 480,
  resolutionMinutes: 2880,
  sampleSubjects: ["Need help with my account", "Question about billing"],
};

export const SECTOR_PACKS: Record<string, SectorPack> = {
  SaaS: {
    key: "SaaS",
    tagline: "Product support, bugs, and account help for software teams.",
    ...DEFAULT_PACK,
    departments: ["general", "product", "billing", "onboarding", "security"],
    tags: [
      { name: "bug", color: "#e11d48" },
      { name: "feature", color: "#7c3aed" },
      { name: "billing", color: "#0369a1" },
      { name: "onboarding", color: "#0f766e" },
    ],
    canned: [
      {
        title: "Bug acknowledged",
        body: "Thanks for the report. We've logged this as a product issue and will update you as soon as we have a fix or workaround.",
      },
      {
        title: "Account access",
        body: "We can help with access. Please confirm the workspace URL and the email on the account (and whether SSO is enabled).",
      },
    ],
    firstResponseMinutes: 120,
    resolutionMinutes: 1440,
    sampleSubjects: ["Login failing on SSO", "API rate limit question"],
  },
  "E-commerce": {
    key: "E-commerce",
    tagline: "Orders, shipping, returns, and payment help for online stores.",
    ...DEFAULT_PACK,
    departments: ["orders", "shipping", "returns", "payments", "general"],
    tags: [
      { name: "order", color: "#0369a1" },
      { name: "shipping", color: "#0f766e" },
      { name: "return", color: "#b45309" },
      { name: "refund", color: "#e11d48" },
    ],
    canned: [
      {
        title: "Order status",
        body: "Thanks for writing. Please share your order number and we'll pull up tracking and next steps right away.",
      },
      {
        title: "Return started",
        body: "We've started your return. You'll receive a prepaid label shortly — reply here if the item isn't listed.",
      },
    ],
    firstResponseMinutes: 60,
    resolutionMinutes: 720,
    sampleSubjects: ["Where is my order?", "Request a return"],
  },
  FinTech: {
    key: "FinTech",
    tagline: "Payments, KYC, and account security for financial products.",
    ...DEFAULT_PACK,
    departments: ["payments", "compliance", "fraud", "onboarding", "general"],
    tags: [
      { name: "payment", color: "#0369a1" },
      { name: "kyc", color: "#7c3aed" },
      { name: "fraud", color: "#e11d48" },
      { name: "payout", color: "#0f766e" },
    ],
    firstResponseMinutes: 30,
    resolutionMinutes: 480,
    sampleSubjects: ["Payout delayed", "KYC documents rejected"],
  },
  Healthcare: {
    key: "Healthcare",
    tagline: "Scheduling, billing, and patient support — privacy-aware workflows.",
    ...DEFAULT_PACK,
    departments: ["scheduling", "billing", "clinical", "pharmacy", "general"],
    tags: [
      { name: "appointment", color: "#0369a1" },
      { name: "insurance", color: "#7c3aed" },
      { name: "prescription", color: "#0f766e" },
      { name: "urgent-care", color: "#e11d48" },
    ],
    canned: [
      {
        title: "Appointment help",
        body: "Thanks for contacting us. Share your preferred date/time and location (or provider name) and we'll assist — please avoid sharing sensitive clinical details over chat if possible.",
      },
    ],
    firstResponseMinutes: 30,
    resolutionMinutes: 240,
    sampleSubjects: ["Reschedule appointment", "Insurance billing question"],
  },
  Education: {
    key: "Education",
    tagline: "Admissions, LMS, and student services for schools and edtech.",
    ...DEFAULT_PACK,
    departments: ["admissions", "it", "billing", "faculty", "general"],
    tags: [
      { name: "enrollment", color: "#0369a1" },
      { name: "lms", color: "#7c3aed" },
      { name: "tuition", color: "#b45309" },
    ],
    firstResponseMinutes: 240,
    resolutionMinutes: 2880,
    sampleSubjects: ["Can't access course", "Tuition receipt needed"],
  },
  Agency: {
    key: "Agency",
    tagline: "Client requests, revisions, and project delivery for agencies.",
    ...DEFAULT_PACK,
    departments: ["account", "creative", "ops", "billing", "general"],
    tags: [
      { name: "revision", color: "#7c3aed" },
      { name: "deadline", color: "#e11d48" },
      { name: "billing", color: "#0369a1" },
    ],
    firstResponseMinutes: 120,
    resolutionMinutes: 1440,
    sampleSubjects: ["Revision on latest draft", "Invoice clarification"],
  },
  Retail: {
    key: "Retail",
    tagline: "In-store and omnichannel support for retail brands.",
    ...DEFAULT_PACK,
    departments: ["store", "online", "loyalty", "returns", "general"],
    firstResponseMinutes: 60,
    resolutionMinutes: 720,
    sampleSubjects: ["Store pickup issue", "Loyalty points missing"],
  },
  Manufacturing: {
    key: "Manufacturing",
    tagline: "Orders, parts, warranties, and B2B fulfillment support.",
    ...DEFAULT_PACK,
    departments: ["orders", "warranty", "parts", "quality", "general"],
    tags: [
      { name: "warranty", color: "#0369a1" },
      { name: "parts", color: "#0f766e" },
      { name: "quality", color: "#e11d48" },
    ],
    firstResponseMinutes: 240,
    resolutionMinutes: 4320,
    sampleSubjects: ["Spare part request", "Warranty claim"],
  },
  Hospitality: {
    key: "Hospitality",
    tagline: "Reservations, guest services, and property requests.",
    ...DEFAULT_PACK,
    departments: ["reservations", "guest-services", "billing", "events", "general"],
    firstResponseMinutes: 15,
    resolutionMinutes: 240,
    sampleSubjects: ["Modify reservation", "Late checkout request"],
  },
  Logistics: {
    key: "Logistics",
    tagline: "Shipments, tracking, and carrier exceptions.",
    ...DEFAULT_PACK,
    departments: ["tracking", "customs", "billing", "claims", "general"],
    tags: [
      { name: "shipment", color: "#0369a1" },
      { name: "delay", color: "#b45309" },
      { name: "claim", color: "#e11d48" },
    ],
    firstResponseMinutes: 60,
    resolutionMinutes: 1440,
    sampleSubjects: ["Shipment delayed", "POD request"],
  },
  "Real Estate": {
    key: "Real Estate",
    tagline: "Leasing, maintenance, and owner/tenant support.",
    ...DEFAULT_PACK,
    departments: ["leasing", "maintenance", "payments", "general"],
    firstResponseMinutes: 120,
    resolutionMinutes: 1440,
    sampleSubjects: ["Maintenance request", "Lease renewal question"],
  },
  Telecom: {
    key: "Telecom",
    tagline: "Connectivity, billing, and service outages.",
    ...DEFAULT_PACK,
    departments: ["network", "billing", "devices", "general"],
    tags: [
      { name: "outage", color: "#e11d48" },
      { name: "billing", color: "#0369a1" },
      { name: "device", color: "#0f766e" },
    ],
    firstResponseMinutes: 30,
    resolutionMinutes: 480,
    sampleSubjects: ["Service down", "Plan upgrade"],
  },
  Government: {
    key: "Government",
    tagline: "Citizen services with clear SLAs and audit-friendly workflows.",
    ...DEFAULT_PACK,
    departments: ["permits", "benefits", "it", "general"],
    firstResponseMinutes: 480,
    resolutionMinutes: 7200,
    sampleSubjects: ["Permit status", "Benefits question"],
  },
  Nonprofit: {
    key: "Nonprofit",
    tagline: "Donor, volunteer, and program support.",
    ...DEFAULT_PACK,
    departments: ["donors", "volunteers", "programs", "general"],
    firstResponseMinutes: 480,
    resolutionMinutes: 4320,
    sampleSubjects: ["Donation receipt", "Volunteer signup help"],
  },
  Other: {
    key: "Other",
    tagline: "Flexible support desk for any team that answers customers.",
    ...DEFAULT_PACK,
  },
};

export function getSectorPack(industry: string | null | undefined): SectorPack {
  if (industry && SECTOR_PACKS[industry]) return SECTOR_PACKS[industry];
  return SECTOR_PACKS.Other;
}
