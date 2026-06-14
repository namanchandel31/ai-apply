import { Navigate, Outlet } from "react-router-dom";
import { useSetupStatus } from "@/hooks/useSetupStatus";

export function OnboardingGuard() {
  const { data: status } = useSetupStatus();

  if (status?.onboardingRequired) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
