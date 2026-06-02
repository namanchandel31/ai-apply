import { Navigate, Outlet } from "react-router-dom";
import { useSetupStatus } from "@/hooks/useSetupStatus";
import { Skeleton } from "@/components/ui/skeleton";

export function OnboardingGuard() {
  const { data: status, isLoading, isError } = useSetupStatus();

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (isError) {
    return <Outlet />;
  }

  if (status?.onboardingRequired) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
