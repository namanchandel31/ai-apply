import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useSetupStatus } from "@/hooks/useSetupStatus";
import { isPricingEnabled } from "@/lib/featureFlags";
import { shouldEnforceSubscriptionPaywall, shouldRequireSubscriptionForPath } from "@/lib/paywallRouting";

export function SubscriptionGuard() {
  const location = useLocation();
  const { data: status, isLoading, isPending } = useSetupStatus();

  if (!isPricingEnabled) {
    return <Outlet />;
  }

  if (isLoading || isPending) {
    const passThroughWhileLoading =
      location.pathname.startsWith("/onboarding") ||
      location.pathname.startsWith("/referrals") ||
      location.pathname.startsWith("/subscriptions");

    if (!passThroughWhileLoading) {
      return (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }
  }

  const needsSubscription =
    shouldEnforceSubscriptionPaywall(status) &&
    status &&
    !status.hasActiveSubscription &&
    shouldRequireSubscriptionForPath(status.paywallTrigger, location.pathname);

  if (needsSubscription) {
    return <Navigate to="/pricing" replace />;
  }

  return <Outlet />;
}
