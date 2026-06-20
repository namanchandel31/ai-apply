import { consumeOnboardingWalkthroughPending } from "@/lib/onboardingWalkthrough";

export const APPLY_WALKTHROUGH_SEEN_KEY = "onetap:apply-walkthrough-seen";

export type ApplyWalkthroughStep = {
  target: string;
  title: string;
  body: string;
  placement: "top" | "bottom";
};

export const APPLY_WALKTHROUGH_STEPS: ApplyWalkthroughStep[] = [
  {
    target: '[data-tour="auto-apply-toggle"]',
    title: "Choose your apply mode",
    body: "Turn Auto apply on to let OneTap send tailored emails from your Gmail automatically after you paste a job description.",
    placement: "bottom",
  },
  {
    target: '[data-tour="apply-composer"]',
    title: "Paste once, apply faster",
    body: "Paste the full job description here. OneTap drafts the outreach email and keeps your flow quick.",
    placement: "top",
  },
  {
    target: '[data-tour="applications-tab"]',
    title: "Track everything in Applications",
    body: "Use Applications to monitor each submission, status updates, and outcomes in one place.",
    placement: "bottom",
  },
  {
    target: '[data-tour="setup-entry"]',
    title: "Setup is always one click away",
    body: "Need to update your AI key, resume, or Gmail? Open Setup from your profile menu anytime.",
    placement: "bottom",
  },
];

export function hasSeenApplyWalkthrough(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(APPLY_WALKTHROUGH_SEEN_KEY) === "true";
}

export function markApplyWalkthroughSeen(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(APPLY_WALKTHROUGH_SEEN_KEY, "true");
}

/** First visit to Apply after onboarding (or first visit ever). */
export function shouldStartApplyWalkthrough(): boolean {
  if (typeof window === "undefined") return false;
  if (hasSeenApplyWalkthrough()) {
    consumeOnboardingWalkthroughPending();
    return false;
  }
  consumeOnboardingWalkthroughPending();
  return true;
}
