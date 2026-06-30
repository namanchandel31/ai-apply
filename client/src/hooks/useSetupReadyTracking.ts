import { useEffect, useRef } from "react";
import type { SetupStatusData } from "@/lib/api";
import { trackProduct } from "@/lib/analytics";

/**
 * Fires setup_ready when user has AI, valid resume, and email configured.
 * Replaces the old activation_completed hook (activation = first application_sent).
 */
export function useSetupReadyTracking(status: SetupStatusData | undefined) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current || !status) return;

    const aiReady = Boolean(status.hasAiSetup || status.hasVerifiedAiCredential || status.canUseManagedAi);
    const ready = aiReady && status.hasValidResume && status.hasEmailSetup;

    if (!ready) return;

    firedRef.current = true;
    trackProduct("setup_ready", {
      has_ai: aiReady,
      has_resume: status.hasValidResume,
      has_gmail: status.hasEmailSetup,
    });
  }, [
    status?.hasAiSetup,
    status?.hasVerifiedAiCredential,
    status?.canUseManagedAi,
    status?.hasValidResume,
    status?.hasEmailSetup,
    status,
  ]);
}
