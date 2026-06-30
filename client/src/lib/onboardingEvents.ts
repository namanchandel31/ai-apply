
export type OnboardingEventName =
  | "onboarding_started"
  | "onboarding_completed"
  | "ai_key_validation_started"
  | "ai_key_verified"
  | "ai_key_validation_failed"
  | "resume_uploaded"
  | "resume_parsed"
  | "gmail_setup_clicked"
  | "email_setup_skipped"
  | "dashboard_entered"
  | "onboarding_abandoned"
  | "extension_prompt_shown"
  | "extension_install_clicked"
  | "extension_installed_detected"
  | "extension_prompt_skipped";

export function trackOnboardingEvent(
  name: OnboardingEventName,
  props?: Record<string, string | boolean | number>
) {
  if (import.meta.env.DEV) {
    console.info("[onboarding]", name, props ?? {});
  }
  window.dispatchEvent(
    new CustomEvent("onetap:onboarding", { detail: { name, props } })
  );
}

export const WELCOME_SEEN_KEY = "onetap_onboarding_welcome_seen";
