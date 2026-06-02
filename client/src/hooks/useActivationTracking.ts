import { useEffect } from "react";
import type { SetupStatusData } from "@/lib/api";
import { markActivationCompleted, type ActivationSource } from "@/lib/onboardingEvents";

export function useActivationTracking(
  status: SetupStatusData | undefined,
  source: ActivationSource
) {
  useEffect(() => {
    if (!status?.hasVerifiedAiCredential || !status?.hasValidResume) return;
    markActivationCompleted(source);
  }, [status?.hasVerifiedAiCredential, status?.hasValidResume, source]);
}
