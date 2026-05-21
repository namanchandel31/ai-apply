import { Navigate, Outlet } from "react-router-dom";
import { api } from "@/lib/api";

export function GuestRoute() {
  if (api.getToken()) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}
