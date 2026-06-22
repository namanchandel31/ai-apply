import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { ResumeParseBackgroundPoller } from "@/components/ResumeParseBackgroundPoller";

export function ProtectedRoute() {
  const { session, isResolved } = useAuth();

  if (!isResolved) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <ResumeParseBackgroundPoller />
      <Outlet />
    </>
  );
}
