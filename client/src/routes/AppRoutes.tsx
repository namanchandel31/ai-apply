import { Navigate, Route, Routes } from "react-router-dom";
import { RealtimeProvider } from "@/contexts/RealtimeProvider";
import { Layout } from "@/components/layout";
import { LoginPage } from "@/pages/login";
import { AuthCallbackPage } from "@/pages/authCallback";
import { Dashboard } from "@/pages/dashboard";
import { Applications } from "@/pages/applications";
import { Setup } from "@/pages/setup";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { GuestRoute } from "@/routes/GuestRoute";
import { SessionHandlers } from "@/auth/SessionHandlers";
import { useAuth } from "@/auth/AuthContext";

function CatchAllRedirect() {
  const { session, isResolved } = useAuth();
  if (!isResolved) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading…</span>
      </div>
    );
  }
  return <Navigate to={session ? "/dashboard" : "/login"} replace />;
}

export function AppRoutes() {
  return (
    <>
      <SessionHandlers />
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route
          element={
            <RealtimeProvider>
              <Layout />
            </RealtimeProvider>
          }
        >
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/applications" element={<Applications />} />
            <Route path="/setup" element={<Setup />} />
          </Route>
        </Route>

        <Route path="*" element={<CatchAllRedirect />} />
      </Routes>
    </>
  );
}
