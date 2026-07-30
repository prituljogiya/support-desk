export type OnboardingState = {
  invitedTeam: boolean;
  brandedPortal: boolean;
  firstTicket: boolean;
  dismissed: boolean;
};

export const EMPTY_ONBOARDING: OnboardingState = {
  invitedTeam: false,
  brandedPortal: false,
  firstTicket: false,
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
    (state.invitedTeam && state.brandedPortal && state.firstTicket)
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
    body: "Set logo and brand color so customers see your company, not a generic desk.",
    href: "/desk/admin?section=settings-branding",
    cta: "Open branding",
  },
  {
    key: "firstTicket" as const,
    title: "Create or receive a ticket",
    body: "Open a sample request from the portal, API, or inbound email.",
    href: "/portal/tickets/new",
    cta: "New portal ticket",
  },
];
