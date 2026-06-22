import type { SetupStatusData } from "@/lib/api";
import { hasDismissedExtensionPrompt, hasEmailStepSkipped } from "@/lib/extensionPrompt";

export const ONBOARDING_STEPS = [
  { id: 1, label: "Upload Resume" },
  { id: 2, label: "Connect Gmail" },
  { id: 3, label: "Install Extension" },
] as const;

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
