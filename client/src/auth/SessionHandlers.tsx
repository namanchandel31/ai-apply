import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  setAuthFailureHandler,
  setUnauthorizedHandler,
  type AuthFailureHandler,
} from "@/lib/api";
import { useAuth } from "@/auth/AuthContext";
import { logout } from "@/auth/logout";
import { isLegacyMigrationBlocked, shouldForceLogout } from "@/lib/authErrors";

/** Wires classified API/SSE auth failures — avoids logout on legacy migration or soft verification errors. */
export function SessionHandlers() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { session, clearAuthState } = useAuth();
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    const handleAuthFailure: AuthFailureHandler = (ctx) => {
      if (!sessionRef.current) return;

      if (isLegacyMigrationBlocked(ctx)) {
        toast.error("Account linking required", {
          description:
            "Sign in matched a legacy account. Complete manual Supabase linking before using the app.",
          id: "legacy-user-link",
        });
        return;
      }

      if (ctx.code === "EMAIL_NOT_VERIFIED") {
        toast.error("Email not verified", {
          description: "Your Google account must have a verified email to use OneTap.",
          id: "email-not-verified",
        });
        return;
      }

      if (!shouldForceLogout(ctx)) return;

      void logout({ queryClient, navigate, clearAuthState });
    };

    setUnauthorizedHandler(handleAuthFailure);
    setAuthFailureHandler(handleAuthFailure);

    return () => {
      setUnauthorizedHandler(null);
      setAuthFailureHandler(null);
    };
  }, [queryClient, navigate, clearAuthState]);

  return null;
}
