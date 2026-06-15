import { Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { AuthenticatedHomeRedirect } from "@/routes/AuthenticatedHomeRedirect";

export function GuestRoute() {
  const { session, isResolved } = useAuth();

  if (!isResolved) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (session) {
    return <AuthenticatedHomeRedirect />;
  }

  return <Outlet />;
}
