export const CHROME_EXTENSION_URL =
  "https://chromewebstore.google.com/detail/onetap/faookfjibeagjdkajoacomepnkielodd";

export const EXTENSION_PROMPT_DISMISSED_KEY = "onetap:extension-prompt-dismissed";
export const ONBOARDING_EXTENSION_PENDING_KEY = "onetap:onboarding-extension-pending";
export const ONBOARDING_EMAIL_SKIPPED_KEY = "onetap:onboarding-email-skipped";

export function hasDismissedExtensionPrompt(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(EXTENSION_PROMPT_DISMISSED_KEY) === "true";
}

export function markExtensionPromptDismissed(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(EXTENSION_PROMPT_DISMISSED_KEY, "true");
  clearOnboardingExtensionPending();
  clearEmailStepSkipped();
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

export function markEmailStepSkipped(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(ONBOARDING_EMAIL_SKIPPED_KEY, "true");
}

export function hasEmailStepSkipped(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(ONBOARDING_EMAIL_SKIPPED_KEY) === "true";
}

export function clearEmailStepSkipped(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(ONBOARDING_EMAIL_SKIPPED_KEY);
}
