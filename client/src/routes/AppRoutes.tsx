import { Navigate, Route, Routes } from "react-router-dom";
import { api } from "@/lib/api";
import { RealtimeProvider } from "@/contexts/RealtimeProvider";
import { Layout } from "@/components/layout";
import { LoginPage } from "@/pages/login";
import { Dashboard } from "@/pages/dashboard";
import { Applications } from "@/pages/applications";
import { Setup } from "@/pages/setup";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { GuestRoute } from "@/routes/GuestRoute";
import { SessionHandlers } from "@/auth/SessionHandlers";

export function AppRoutes() {
  return (
    <>
      <SessionHandlers />
      <Routes>
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

      <Route
        path="*"
        element={
          <Navigate to={api.getToken() ? "/dashboard" : "/login"} replace />
        }
      />
    </Routes>
    </>
  );
}
