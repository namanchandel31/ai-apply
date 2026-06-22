import { useEffect } from "react";
import type { SetupStatusData } from "@/lib/api";
import { markActivationCompleted, type ActivationSource } from "@/lib/onboardingEvents";

export function useActivationTracking(
  status: SetupStatusData | undefined,
  source: ActivationSource
) {
  useEffect(() => {
    const aiReady = Boolean(status?.hasAiSetup || status?.hasVerifiedAiCredential);
    if (!aiReady || !status?.hasValidResume) return;
    markActivationCompleted(source);
  }, [status?.hasAiSetup, status?.hasVerifiedAiCredential, status?.hasValidResume, source]);
}
