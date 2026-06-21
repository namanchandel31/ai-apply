import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useSetupStatus } from "@/hooks/useSetupStatus";
import { isPricingEnabled } from "@/lib/featureFlags";

export function SubscriptionGuard() {
  const { data: status, isLoading } = useSetupStatus();

  if (!isPricingEnabled) {
    return <Outlet />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!status?.hasActiveSubscription) {
    return <Navigate to="/pricing" replace />;
  }

  return <Outlet />;
}
