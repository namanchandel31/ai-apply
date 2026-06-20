import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useSetupStatus } from "@/hooks/useSetupStatus";

/** Waits for setup status, then routes to onboarding or dashboard (no dashboard flash). */
export function AuthenticatedHomeRedirect() {
  const { data: status, isLoading, isError } = useSetupStatus();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const to =
    !isError && status
      ? !status.hasActiveSubscription
        ? "/pricing"
        : !status.onboardingRequired
          ? "/dashboard"
          : "/onboarding"
      : "/pricing";

  return <Navigate to={to} replace />;
}
