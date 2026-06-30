import { useEffect, useRef } from "react";
import type { OnboardingFlowStep } from "@/lib/onboardingFlow";
import {
  getStepDurationMs,
  markStepStarted,
  ONBOARDING_FLOW,
  ONBOARDING_STEP_INDEX,
  stepEventName,
  tierForStepEvent,
  trackEvent,
  type OnboardingStepName,
} from "@/lib/analytics";

function toStepName(step: OnboardingFlowStep): OnboardingStepName | null {
  if (step === "complete") return null;
  if (step === "email") return "gmail";
  return step;
}

export function useOnboardingStepAnalytics(step: OnboardingFlowStep) {
  const prevStepRef = useRef<OnboardingFlowStep | null>(null);

  useEffect(() => {
    const stepName = toStepName(step);
    if (!stepName) return;

    const prev = prevStepRef.current;
    if (prev && prev !== step && prev !== "complete") {
      const prevName = toStepName(prev);
      if (prevName) {
        trackEvent(
          stepEventName(ONBOARDING_FLOW, "completed"),
          {
            flow: ONBOARDING_FLOW,
            step_name: prevName,
            step_index: ONBOARDING_STEP_INDEX[prevName],
            duration_ms: getStepDurationMs(ONBOARDING_FLOW, prevName),
            onboarding_version: "v1",
          },
          { tier: "product" }
        );
      }
    }

    if (prev !== step) {
      markStepStarted(ONBOARDING_FLOW, stepName);
      trackEvent(
        stepEventName(ONBOARDING_FLOW, "started"),
        {
          flow: ONBOARDING_FLOW,
          step_name: stepName,
          step_index: ONBOARDING_STEP_INDEX[stepName],
          onboarding_version: "v1",
        },
        { tier: "product" }
      );
      prevStepRef.current = step;
    }
  }, [step]);
}

export function trackOnboardingStepSkipped(
  stepName: Exclude<OnboardingStepName, "resume">,
  connectionMethod?: "oauth" | "app_password"
) {
  trackEvent(
    stepEventName(ONBOARDING_FLOW, "skipped"),
    {
      flow: ONBOARDING_FLOW,
      step_name: stepName,
      step_index: ONBOARDING_STEP_INDEX[stepName],
      duration_ms: getStepDurationMs(ONBOARDING_FLOW, stepName),
      connection_method: connectionMethod ?? null,
      onboarding_version: "v1",
    },
    { tier: "product" }
  );
}

export function trackOnboardingStepFailed(
  stepName: OnboardingStepName,
  failure_reason: string,
  connectionMethod?: "oauth" | "app_password"
) {
  trackEvent(
    stepEventName(ONBOARDING_FLOW, "failed"),
    {
      flow: ONBOARDING_FLOW,
      step_name: stepName,
      step_index: ONBOARDING_STEP_INDEX[stepName],
      failure_reason,
      connection_method: connectionMethod ?? null,
      onboarding_version: "v1",
    },
    { tier: tierForStepEvent("failed") }
  );
}
