export type OnboardingState = {
  invitedTeam: boolean;
  brandedPortal: boolean;
  firstTicket: boolean;
  connectedChannel: boolean;
  dismissed: boolean;
};

export const EMPTY_ONBOARDING: OnboardingState = {
  invitedTeam: false,
  brandedPortal: false,
  firstTicket: false,
  connectedChannel: false,
  dismissed: false,
};

export function parseOnboarding(raw: string | null | undefined): OnboardingState {
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<OnboardingState>) : {};
    return { ...EMPTY_ONBOARDING, ...parsed };
  } catch {
    return { ...EMPTY_ONBOARDING };
  }
}

export function onboardingComplete(state: OnboardingState) {
  return (
    state.dismissed ||
    (state.invitedTeam &&
      state.brandedPortal &&
      state.firstTicket &&
      state.connectedChannel)
  );
}

export const ONBOARDING_STEPS = [
  {
    key: "invitedTeam" as const,
    title: "Invite your team",
    body: "Add an agent or admin so tickets aren’t stuck on you alone.",
    href: "/desk/admin?section=users",
    cta: "Invite teammate",
  },
  {
    key: "brandedPortal" as const,
    title: "Brand your portal",
    body: "Set logo, brand color, and industry so the desk matches your sector.",
    href: "/desk/admin?section=settings-company",
    cta: "Open company settings",
  },
  {
    key: "connectedChannel" as const,
    title: "Connect a channel",
    body: "One click to enable portal/API, or connect email and WhatsApp so tickets arrive everywhere.",
    href: "/desk/admin?section=omni-hub",
    cta: "Open channels",
  },
  {
    key: "firstTicket" as const,
    title: "Create or receive a ticket",
    body: "Open a sample request from the portal, API, WhatsApp, or inbound email.",
    href: "/portal/tickets/new",
    cta: "New portal ticket",
  },
];
