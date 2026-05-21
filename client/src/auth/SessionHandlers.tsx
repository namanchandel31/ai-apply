import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, setUnauthorizedHandler } from "@/lib/api";
import { useAuth } from "@/auth/AuthContext";
import { logout } from "@/auth/logout";

/** Wires global 401 handling to the same logout path as Sign out. */
export function SessionHandlers() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { setUser } = useAuth();

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!api.getToken()) return;
      logout(queryClient, navigate);
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, [queryClient, navigate, setUser]);

  return null;
}
