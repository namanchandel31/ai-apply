export const CHROME_EXTENSION_URL =
  "https://chromewebstore.google.com/detail/onetap/faookfjibeagjdkajoacomepnkielodd";

export const EXTENSION_PROMPT_DISMISSED_KEY = "onetap:extension-prompt-dismissed";
export const ONBOARDING_EXTENSION_PENDING_KEY = "onetap:onboarding-extension-pending";

export function hasDismissedExtensionPrompt(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(EXTENSION_PROMPT_DISMISSED_KEY) === "true";
}

export function markExtensionPromptDismissed(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(EXTENSION_PROMPT_DISMISSED_KEY, "true");
  clearOnboardingExtensionPending();
}

export function markOnboardingExtensionPending(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(ONBOARDING_EXTENSION_PENDING_KEY, "true");
}

export function hasOnboardingExtensionPending(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(ONBOARDING_EXTENSION_PENDING_KEY) === "true";
}

export function clearOnboardingExtensionPending(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(ONBOARDING_EXTENSION_PENDING_KEY);
}

export const ONBOARDING_EMAIL_SKIPPED_KEY = "onetap:onboarding-email-skipped";
/** @deprecated migrated to localStorage — read for backward compatibility */
const ONBOARDING_EMAIL_SKIPPED_SESSION_KEY = "onetap:onboarding-email-skipped";

export function markEmailStepSkipped(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ONBOARDING_EMAIL_SKIPPED_KEY, "true");
  window.sessionStorage.removeItem(ONBOARDING_EMAIL_SKIPPED_SESSION_KEY);
}

export function hasEmailStepSkipped(): boolean {
  if (typeof window === "undefined") return false;
  if (window.localStorage.getItem(ONBOARDING_EMAIL_SKIPPED_KEY) === "true") return true;
  return window.sessionStorage.getItem(ONBOARDING_EMAIL_SKIPPED_SESSION_KEY) === "true";
}

export function clearEmailStepSkipped(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ONBOARDING_EMAIL_SKIPPED_KEY);
  window.sessionStorage.removeItem(ONBOARDING_EMAIL_SKIPPED_SESSION_KEY);
}
