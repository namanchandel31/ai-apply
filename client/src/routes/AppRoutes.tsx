import { Navigate, Route, Routes } from "react-router-dom";
import { RealtimeProvider } from "@/contexts/RealtimeProvider";
import { Layout } from "@/components/layout";
import { LandingPage } from "@/pages/landing";
import { LoginPage } from "@/pages/login";
import { AuthCallbackPage } from "@/pages/authCallback";
import { Dashboard } from "@/pages/dashboard";
import { Applications } from "@/pages/applications";
import { Setup } from "@/pages/setup";
import { SettingsExtension } from "@/pages/settingsExtension";
import { Onboarding } from "@/pages/onboarding";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { GuestRoute } from "@/routes/GuestRoute";
import { OnboardingGuard } from "@/routes/OnboardingGuard";
import { AuthenticatedHomeRedirect } from "@/routes/AuthenticatedHomeRedirect";
import { SessionHandlers } from "@/auth/SessionHandlers";
import { useAuth } from "@/auth/AuthContext";
import { AdminPage } from "@/pages/admin";
import { PrivacyPolicyPage } from "@/pages/privacyPolicy";
import { SupportPage } from "@/pages/support";

function CatchAllRedirect() {
  const { session, isResolved } = useAuth();
  if (!isResolved) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading…</span>
      </div>
    );
  }
  return session ? <AuthenticatedHomeRedirect /> : <Navigate to="/login" replace />;
}

export function AppRoutes() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin);

  return (
    <>
      <SessionHandlers />
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/support" element={<SupportPage />} />

        <Route element={<GuestRoute />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route
            element={
              <RealtimeProvider>
                <Layout />
              </RealtimeProvider>
            }
          >
            <Route element={<OnboardingGuard />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/applications" element={<Applications />} />
            </Route>
            <Route path="/setup" element={<Setup />} />
            <Route path="/settings/extension" element={<SettingsExtension />} />
            {isAdmin && <Route path="/admin" element={<AdminPage />} />}
          </Route>
        </Route>

        <Route path="*" element={<CatchAllRedirect />} />
      </Routes>
    </>
  );
}
