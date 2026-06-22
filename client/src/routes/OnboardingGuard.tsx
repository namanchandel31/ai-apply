import { Navigate, Outlet } from "react-router-dom";
import { useSetupStatus } from "@/hooks/useSetupStatus";
import { isOnboardingFlowComplete } from "@/lib/onboardingFlow";

export function OnboardingGuard() {
  const { data: status } = useSetupStatus();

  if (!isOnboardingFlowComplete(status)) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
