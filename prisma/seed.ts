import {
  MembershipRole,
  PrismaClient,
  TicketPriority,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PLAN_FEATURES = {
  free: {
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
  },
  pro: {
    sla: true,
    macros: true,
    cannedResponses: true,
    freshdeskSync: true,
    savedViews: true,
    contacts: true,
    knowledge: true,
    automation: true,
    export: true,
    aiAssistant: true,
    liveChat: true,
    whatsapp: false,
    assetManagement: false,
    analytics: true,
    whiteLabel: false,
    sso: false,
  },
  enterprise: {
    sla: true,
    macros: true,
    cannedResponses: true,
    freshdeskSync: true,
    savedViews: true,
    contacts: true,
    knowledge: true,
    automation: true,
    export: true,
    aiAssistant: true,
    liveChat: true,
    whatsapp: true,
    assetManagement: true,
    analytics: true,
    whiteLabel: true,
    sso: true,
  },
} as const;

async function upsertUser(input: {
  email: string;
  name: string;
  password: string;
  isSuperAdmin?: boolean;
}) {
  const passwordHash = await bcrypt.hash(input.password, 10);
  return prisma.user.upsert({
    where: { email: input.email },
    update: {
      name: input.name,
      passwordHash,
      isSuperAdmin: input.isSuperAdmin ?? false,
    },
    create: {
      email: input.email,
      name: input.name,
      passwordHash,
      isSuperAdmin: input.isSuperAdmin ?? false,
    },
  });
}

async function ensureMembership(
  userId: string,
  organizationId: string,
  role: MembershipRole,
) {
  return prisma.membership.upsert({
    where: {
      userId_organizationId: { userId, organizationId },
    },
    update: { role },
    create: { userId, organizationId, role },
  });
}

async function main() {
  const free = await prisma.plan.upsert({
    where: { key: "free" },
    update: {
      name: "Free",
      description: "Starter helpdesk for small teams",
      seatLimit: 3,
      features: JSON.stringify(PLAN_FEATURES.free),
      sortOrder: 0,
      monthlyPriceCents: 0,
      yearlyPriceCents: 0,
      trialDays: 0,
      active: true,
    },
    create: {
      key: "free",
      name: "Free",
      description: "Starter helpdesk for small teams",
      seatLimit: 3,
      features: JSON.stringify(PLAN_FEATURES.free),
      sortOrder: 0,
      monthlyPriceCents: 0,
      yearlyPriceCents: 0,
      trialDays: 0,
      active: true,
    },
  });

  const pro = await prisma.plan.upsert({
    where: { key: "pro" },
    update: {
      name: "Pro",
      description: "SLA, macros, and Freshdesk sync",
      seatLimit: 25,
      features: JSON.stringify(PLAN_FEATURES.pro),
      sortOrder: 1,
      monthlyPriceCents: 4900,
      yearlyPriceCents: 49000,
      trialDays: 14,
      active: true,
    },
    create: {
      key: "pro",
      name: "Pro",
      description: "SLA, macros, and Freshdesk sync",
      seatLimit: 25,
      features: JSON.stringify(PLAN_FEATURES.pro),
      sortOrder: 1,
      monthlyPriceCents: 4900,
      yearlyPriceCents: 49000,
      trialDays: 14,
      active: true,
    },
  });

  await prisma.plan.upsert({
    where: { key: "enterprise" },
    update: {
      name: "Enterprise",
      description: "Higher seats and all Pro features",
      seatLimit: 200,
      features: JSON.stringify(PLAN_FEATURES.enterprise),
      sortOrder: 2,
      monthlyPriceCents: 14900,
      yearlyPriceCents: 149000,
      trialDays: 30,
      active: true,
    },
    create: {
      key: "enterprise",
      name: "Enterprise",
      description: "Higher seats and all Pro features",
      seatLimit: 200,
      features: JSON.stringify(PLAN_FEATURES.enterprise),
      sortOrder: 2,
      monthlyPriceCents: 14900,
      yearlyPriceCents: 149000,
      trialDays: 30,
      active: true,
    },
  });

  const superAdmin = await upsertUser({
    email: "super@example.com",
    name: "Platform Super Admin",
    password: "password123",
    isSuperAdmin: true,
  });

  const owner = await upsertUser({
    email: "admin@example.com",
    name: "Demo Owner",
    password: "password123",
  });

  const agent = await upsertUser({
    email: "agent@example.com",
    name: "Demo Agent",
    password: "password123",
  });

  const manager = await upsertUser({
    email: "manager@example.com",
    name: "Demo Manager",
    password: "password123",
  });

  const supervisor = await upsertUser({
    email: "lead@example.com",
    name: "Demo Team Lead",
    password: "password123",
  });

  const junior = await upsertUser({
    email: "junior@example.com",
    name: "Demo Junior Agent",
    password: "password123",
  });

  const qa = await upsertUser({
    email: "qa@example.com",
    name: "Demo QA",
    password: "password123",
  });

  const auditor = await upsertUser({
    email: "auditor@example.com",
    name: "Demo Auditor",
    password: "password123",
  });

  const customer = await upsertUser({
    email: "customer@example.com",
    name: "Demo Customer",
    password: "password123",
  });

  const org = await prisma.organization.upsert({
    where: { slug: "acme-support" },
    update: {
      name: "Acme Support",
      planId: pro.id,
      brandColor: "#0c4a6e",
      disabled: false,
      industry: "SaaS",
      companySize: "51-200",
      country: "US",
      region: "California",
      city: "San Francisco",
      billingEmail: "billing@acme.example",
      billingContact: "Acme Finance",
      phone: "+1-415-555-0100",
      website: "https://acme.example",
      segment: "mid-market",
      mrrCents: 24900,
      healthScore: 92,
      notes: "Flagship demo tenant. Strong CSAT, Pro plan.",
      whiteLabel: false,
      customDomain: "support.acme.example",
    },
    create: {
      name: "Acme Support",
      slug: "acme-support",
      planId: pro.id,
      brandColor: "#0c4a6e",
      industry: "SaaS",
      companySize: "51-200",
      country: "US",
      region: "California",
      city: "San Francisco",
      billingEmail: "billing@acme.example",
      billingContact: "Acme Finance",
      phone: "+1-415-555-0100",
      website: "https://acme.example",
      segment: "mid-market",
      mrrCents: 24900,
      healthScore: 92,
      notes: "Flagship demo tenant. Strong CSAT, Pro plan.",
      customDomain: "support.acme.example",
    },
  });

  const beta = await prisma.organization.upsert({
    where: { slug: "northstar-retail" },
    update: {
      name: "Northstar Retail",
      planId: free.id,
      industry: "Retail",
      companySize: "11-50",
      country: "IN",
      region: "Gujarat",
      city: "Ahmedabad",
      segment: "smb",
      mrrCents: 0,
      healthScore: 78,
      trialEndsAt: new Date(Date.now() + 14 * 864e5),
      billingEmail: "ops@northstar.example",
      notes: "Trial retail tenant in APAC.",
    },
    create: {
      name: "Northstar Retail",
      slug: "northstar-retail",
      planId: free.id,
      industry: "Retail",
      companySize: "11-50",
      country: "IN",
      region: "Gujarat",
      city: "Ahmedabad",
      segment: "smb",
      mrrCents: 0,
      healthScore: 78,
      trialEndsAt: new Date(Date.now() + 14 * 864e5),
      billingEmail: "ops@northstar.example",
      notes: "Trial retail tenant in APAC.",
    },
  });

  const enterpriseOrg = await prisma.organization.upsert({
    where: { slug: "helix-fintech" },
    update: {
      name: "Helix FinTech",
      planId: (await prisma.plan.findUnique({ where: { key: "enterprise" } }))!
        .id,
      industry: "FinTech",
      companySize: "201-1000",
      country: "GB",
      region: "England",
      city: "London",
      segment: "enterprise",
      mrrCents: 129900,
      healthScore: 88,
      whiteLabel: true,
      customDomain: "help.helix.example",
      billingEmail: "ap@helix.example",
      notes: "Enterprise white-label account.",
    },
    create: {
      name: "Helix FinTech",
      slug: "helix-fintech",
      planId: (await prisma.plan.findUnique({ where: { key: "enterprise" } }))!
        .id,
      industry: "FinTech",
      companySize: "201-1000",
      country: "GB",
      region: "England",
      city: "London",
      segment: "enterprise",
      mrrCents: 129900,
      healthScore: 88,
      whiteLabel: true,
      customDomain: "help.helix.example",
      billingEmail: "ap@helix.example",
      notes: "Enterprise white-label account.",
    },
  });

  void beta;
  void enterpriseOrg;

  await ensureMembership(owner.id, org.id, "owner");
  await ensureMembership(agent.id, org.id, "agent");
  await ensureMembership(manager.id, org.id, "manager");
  await ensureMembership(supervisor.id, org.id, "supervisor");
  await ensureMembership(junior.id, org.id, "junior_agent");
  await ensureMembership(qa.id, org.id, "qa");
  await ensureMembership(auditor.id, org.id, "auditor");
  await ensureMembership(customer.id, org.id, "customer");

  await prisma.platformSetting.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  await prisma.coupon.upsert({
    where: { code: "LAUNCH20" },
    update: { percentOff: 20, active: true },
    create: { code: "LAUNCH20", percentOff: 20, maxRedemptions: 100 },
  });

  await prisma.businessHours.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      timezone: "UTC",
    },
  });

  for (const policy of [
    {
      name: "Default",
      priority: null as TicketPriority | null,
      firstResponseMinutes: 480,
      resolutionMinutes: 2880,
      isDefault: true,
    },
    {
      name: "Urgent",
      priority: "urgent" as TicketPriority,
      firstResponseMinutes: 60,
      resolutionMinutes: 240,
      isDefault: false,
    },
    {
      name: "High",
      priority: "high" as TicketPriority,
      firstResponseMinutes: 120,
      resolutionMinutes: 480,
      isDefault: false,
    },
  ]) {
    const existing = await prisma.slaPolicy.findFirst({
      where: {
        organizationId: org.id,
        name: policy.name,
      },
    });
    if (existing) {
      await prisma.slaPolicy.update({
        where: { id: existing.id },
        data: policy,
      });
    } else {
      await prisma.slaPolicy.create({
        data: { organizationId: org.id, ...policy },
      });
    }
  }

  const company = await prisma.company.upsert({
    where: { id: "seed-acme-co" },
    update: { name: "Acme Corp", domain: "acme.example" },
    create: {
      id: "seed-acme-co",
      organizationId: org.id,
      name: "Acme Corp",
      domain: "acme.example",
    },
  });

  const contact = await prisma.contact.upsert({
    where: {
      organizationId_email: {
        organizationId: org.id,
        email: customer.email,
      },
    },
    update: {
      name: customer.name,
      companyId: company.id,
    },
    create: {
      organizationId: org.id,
      companyId: company.id,
      name: customer.name,
      email: customer.email,
      createdById: owner.id,
    },
  });

  for (const tag of [
    { name: "billing", color: "#0369a1" },
    { name: "bug", color: "#be123c" },
    { name: "how-to", color: "#047857" },
  ]) {
    await prisma.tag.upsert({
      where: {
        organizationId_name: { organizationId: org.id, name: tag.name },
      },
      update: { color: tag.color },
      create: { organizationId: org.id, ...tag },
    });
  }

  const billingTag = await prisma.tag.findUniqueOrThrow({
    where: {
      organizationId_name: { organizationId: org.id, name: "billing" },
    },
  });

  const canned = [
    {
      title: "Password reset help",
      body: "Hi {{name}},\n\nYou can reset your password from the login page using Forgot password. If you still need help, reply here and we will assist.\n\nThanks,\nSupport",
      keywords: "password reset login access",
    },
    {
      title: "Billing acknowledgment",
      body: "Hi {{name}},\n\nThanks for reaching out about billing. We are looking into your account and will update you shortly.\n\nThanks,\nSupport",
      keywords: "billing invoice payment charge refund",
    },
    {
      title: "Bug triage",
      body: "Hi {{name}},\n\nThanks for the report. Could you share steps to reproduce, browser/OS, and any screenshots?\n\nThanks,\nSupport",
      keywords: "bug error crash broken issue",
    },
  ];

  for (const item of canned) {
    const existing = await prisma.cannedResponse.findFirst({
      where: { organizationId: org.id, title: item.title },
    });
    if (existing) {
      await prisma.cannedResponse.update({
        where: { id: existing.id },
        data: { ...item, createdById: owner.id },
      });
    } else {
      await prisma.cannedResponse.create({
        data: { organizationId: org.id, createdById: owner.id, ...item },
      });
    }
  }

  const closeResolved = await prisma.macro.findFirst({
    where: { organizationId: org.id, name: "Resolve + thank you" },
  });
  const macroActions = JSON.stringify({
    status: "resolved",
    priority: null,
    addTagIds: [billingTag.id],
    reply:
      "Thanks for contacting us. We believe this is resolved — reply if you need anything else.",
  });
  if (closeResolved) {
    await prisma.macro.update({
      where: { id: closeResolved.id },
      data: {
        description: "Mark resolved and send a thank-you reply",
        actions: macroActions,
        createdById: owner.id,
      },
    });
  } else {
    await prisma.macro.create({
      data: {
        organizationId: org.id,
        name: "Resolve + thank you",
        description: "Mark resolved and send a thank-you reply",
        actions: macroActions,
        createdById: owner.id,
      },
    });
  }

  await prisma.savedView.upsert({
    where: { id: "seed-view-unassigned" },
    update: {
      name: "Unassigned open",
      filters: JSON.stringify({ status: "open", assigneeId: "unassigned" }),
      isShared: true,
    },
    create: {
      id: "seed-view-unassigned",
      organizationId: org.id,
      userId: owner.id,
      name: "Unassigned open",
      filters: JSON.stringify({ status: "open", assigneeId: "unassigned" }),
      isShared: true,
    },
  });

  await prisma.syncCursor.upsert({
    where: {
      organizationId_key: { organizationId: org.id, key: "freshdesk" },
    },
    create: { organizationId: org.id, key: "freshdesk" },
    update: {},
  });

  const existingTicket = await prisma.ticket.findFirst({
    where: {
      organizationId: org.id,
      requesterId: customer.id,
      subject: "Welcome — demo ticket",
    },
  });

  if (!existingTicket) {
    const dueFirst = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const dueRes = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await prisma.ticket.create({
      data: {
        organizationId: org.id,
        subject: "Welcome — demo ticket",
        description:
          "This is a seeded demo ticket. Reply here or from the agent desk.",
        status: "open",
        priority: "medium",
        requesterId: customer.id,
        assigneeId: agent.id,
        contactId: contact.id,
        syncStatus: "skipped",
        firstResponseDueAt: dueFirst,
        resolutionDueAt: dueRes,
        messages: {
          create: {
            authorId: customer.id,
            body: "This is a seeded demo ticket. Reply here or from the agent desk.",
            isInternal: false,
            syncStatus: "skipped",
          },
        },
        tags: {
          create: { tagId: billingTag.id },
        },
      },
    });
  }

  const kbExisting = await prisma.knowledgeArticle.findFirst({
    where: { organizationId: org.id, slug: "reset-your-password" },
  });
  if (!kbExisting) {
    await prisma.knowledgeArticle.createMany({
      data: [
        {
          organizationId: org.id,
          authorId: owner.id,
          title: "Reset your password",
          slug: "reset-your-password",
          category: "Account",
          body: "1. Open the login page\n2. Click Forgot password\n3. Check your email for a reset link\n4. Choose a new password and sign in.",
          published: true,
        },
        {
          organizationId: org.id,
          authorId: owner.id,
          title: "How billing cycles work",
          slug: "billing-cycles",
          category: "Billing",
          body: "Subscriptions renew monthly on your signup date. Invoices are emailed to the billing contact. Contact support if a charge looks incorrect.",
          published: true,
        },
        {
          organizationId: org.id,
          authorId: owner.id,
          title: "Report a bug",
          slug: "report-a-bug",
          category: "Product",
          body: "Include steps to reproduce, browser/OS, screenshots, and expected vs actual behavior. Mark urgent bugs as high priority.",
          published: true,
        },
      ],
    });
  }

  const autoExisting = await prisma.automationRule.findFirst({
    where: { organizationId: org.id, name: "Billing → assign agent" },
  });
  if (!autoExisting) {
    await prisma.automationRule.create({
      data: {
        organizationId: org.id,
        name: "Billing → assign agent",
        enabled: true,
        match: JSON.stringify({ keywords: ["billing", "invoice", "payment"] }),
        actions: JSON.stringify({
          assigneeId: agent.id,
          addTagIds: [billingTag.id],
          setPriority: "high",
        }),
      },
    });
  }

  // Keep free plan reference used so unused var lint doesn't fire in seed
  void free;

  const billingCount = await prisma.billingEvent.count();
  if (billingCount === 0) {
    const helix = await prisma.organization.findUnique({
      where: { slug: "helix-fintech" },
    });
    const events = [
      {
        organizationId: org.id,
        type: "payment" as const,
        amountCents: 24900,
        taxCents: 1992,
        invoiceNumber: "INV-ACME-001",
        description: "Pro plan · monthly",
        occurredAt: new Date(Date.now() - 2 * 864e5),
      },
      {
        organizationId: org.id,
        type: "renewal" as const,
        amountCents: 24900,
        taxCents: 1992,
        invoiceNumber: "INV-ACME-002",
        description: "Pro renewal",
        occurredAt: new Date(Date.now() - 1 * 864e5),
      },
      {
        organizationId: org.id,
        type: "invoice" as const,
        amountCents: 24900,
        taxCents: 1992,
        invoiceNumber: "INV-ACME-002",
        description: "Invoice PDF ready",
        occurredAt: new Date(Date.now() - 1 * 864e5),
      },
      {
        organizationId: helix?.id,
        type: "payment" as const,
        amountCents: 129900,
        taxCents: 10392,
        invoiceNumber: "INV-HELIX-010",
        description: "Enterprise · monthly",
        occurredAt: new Date(Date.now() - 5 * 864e5),
      },
      {
        organizationId: helix?.id,
        type: "pending" as const,
        amountCents: 129900,
        taxCents: 10392,
        invoiceNumber: "INV-HELIX-011",
        description: "Upcoming renewal",
        status: "pending",
        occurredAt: new Date(),
      },
      {
        organizationId: org.id,
        type: "failed" as const,
        amountCents: 24900,
        description: "Card declined",
        status: "failed",
        occurredAt: new Date(Date.now() - 10 * 864e5),
      },
      {
        organizationId: org.id,
        type: "refund" as const,
        amountCents: 4900,
        taxCents: 392,
        invoiceNumber: "CR-ACME-003",
        description: "Partial refund · seats",
        occurredAt: new Date(Date.now() - 8 * 864e5),
      },
    ];
    for (const e of events) {
      await prisma.billingEvent.create({ data: e });
    }
  }

  await prisma.platformSetting.upsert({
    where: { id: "default" },
    update: {
      featuresJson: JSON.stringify({
        aiAssistant: true,
        liveChat: true,
        whatsapp: true,
        knowledge: true,
        assetManagement: true,
        automation: true,
        analytics: true,
        whiteLabel: true,
        sso: true,
      }),
      queueJson: JSON.stringify({ pending: 4, failed: 0 }),
      cacheJson: JSON.stringify({ hitRate: 93 }),
    },
    create: {
      id: "default",
      featuresJson: JSON.stringify({
        aiAssistant: true,
        liveChat: true,
        analytics: true,
      }),
    },
  });

  console.log("Seeded multi-tenant demo:");
  console.log(`  org       ${org.name} (${org.slug}) · plan Pro`);
  console.log(`  super     ${superAdmin.email} / password123  → /platform`);
  console.log(`  owner     ${owner.email} / password123`);
  console.log(`  manager   ${manager.email} / password123`);
  console.log(`  lead      ${supervisor.email} / password123`);
  console.log(`  agent     ${agent.email} / password123`);
  console.log(`  junior    ${junior.email} / password123`);
  console.log(`  qa        ${qa.email} / password123`);
  console.log(`  auditor   ${auditor.email} / password123`);
  console.log(`  customer  ${customer.email} / password123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
