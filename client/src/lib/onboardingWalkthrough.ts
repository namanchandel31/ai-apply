/** Set when onboarding completes; dashboard can show first-run walkthrough (future). */
export const ONBOARDING_WALKTHROUGH_PENDING_KEY = "onetap:onboarding-walkthrough-pending";

export function markOnboardingWalkthroughPending(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ONBOARDING_WALKTHROUGH_PENDING_KEY, "true");
}

export function consumeOnboardingWalkthroughPending(): boolean {
  if (typeof window === "undefined") return false;
  const pending = sessionStorage.getItem(ONBOARDING_WALKTHROUGH_PENDING_KEY) === "true";
  if (pending) sessionStorage.removeItem(ONBOARDING_WALKTHROUGH_PENDING_KEY);
  return pending;
}
