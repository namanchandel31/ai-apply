import type { SetupStatusData } from "@/lib/api";
import { hasDismissedExtensionPrompt, hasEmailStepSkipped } from "@/lib/extensionPrompt";

export const ONBOARDING_STEPS = [
  { id: 1, label: "Your resume" },
  { id: 2, label: "Connect Gmail" },
  { id: 3, label: "Install Extension" },
] as const;

/** Shared layout classes for onboarding card step content */
export const ONBOARDING_STEP_SECTION_CLASS = "space-y-4";
export const ONBOARDING_STEP_HEADLINE_CLASS = "text-xl font-semibold text-foreground";
export const ONBOARDING_STEP_DESCRIPTION_CLASS = "mt-1.5 text-base text-muted-foreground";
export const ONBOARDING_STEP_DESCRIPTION_FOLLOWUP_CLASS = "mt-2 text-base text-muted-foreground";

export type OnboardingFlowStep = "resume" | "email" | "extension" | "complete";

export function computeOnboardingFlow(
  status: SetupStatusData | undefined,
  opts?: { emailSkipped?: boolean; extensionDone?: boolean }
) {
  const hasResume = !!status?.hasResume;
  const hasEmailSetup = !!status?.hasEmailSetup;
  const emailResolved =
    hasEmailSetup || opts?.emailSkipped === true || hasEmailStepSkipped();
  const extensionResolved =
    opts?.extensionDone === true || hasDismissedExtensionPrompt();

  const steps = ONBOARDING_STEPS;

  if (!hasResume) {
    return { step: "resume" as const, stepIndex: 1, steps, complete: false };
  }
  if (!emailResolved) {
    return { step: "email" as const, stepIndex: 2, steps, complete: false };
  }
  if (!extensionResolved) {
    return { step: "extension" as const, stepIndex: 3, steps, complete: false };
  }
  return { step: "complete" as const, stepIndex: 0, steps, complete: true };
}

export function isOnboardingFlowComplete(
  status: SetupStatusData | undefined,
  opts?: { emailSkipped?: boolean; extensionDone?: boolean }
): boolean {
  if (!status) return false;
  return computeOnboardingFlow(status, opts).complete;
}
