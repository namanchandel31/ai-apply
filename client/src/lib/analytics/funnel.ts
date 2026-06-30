import type { EventTier } from "./types";

const stepStarts = new Map<string, number>();

function stepKey(flow: string, stepName: string) {
  return `${flow}:${stepName}`;
}

export function markStepStarted(flow: string, stepName: string) {
  stepStarts.set(stepKey(flow, stepName), Date.now());
}

export function getStepDurationMs(flow: string, stepName: string): number | undefined {
  const started = stepStarts.get(stepKey(flow, stepName));
  if (!started) return undefined;
  return Date.now() - started;
}

export function clearStep(flow: string, stepName: string) {
  stepStarts.delete(stepKey(flow, stepName));
}

export type StepEventSuffix = "started" | "completed" | "skipped" | "failed";

export function stepEventName(flow: string, suffix: StepEventSuffix) {
  return `${flow}_step_${suffix}`;
}

export const ONBOARDING_FLOW = "onboarding";

export type OnboardingStepName = "resume" | "gmail" | "extension";

export const ONBOARDING_STEP_INDEX: Record<OnboardingStepName, number> = {
  resume: 1,
  gmail: 2,
  extension: 3,
};

export function tierForStepEvent(suffix: StepEventSuffix): EventTier {
  return suffix === "failed" ? "operational" : "product";
}
