import type { QueryClient } from "@tanstack/react-query";
import type { NavigateFunction } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { shutdownRealtimeSession } from "@/contexts/RealtimeProvider";
import { resetOrchestrationRegistry } from "@/services/orchestration/orchestrationRegistry";
import { logAuthLifecycle } from "@/auth/authLifecycleLog";

const SIGN_OUT_TIMEOUT_MS = 8_000;

let logoutInFlight: Promise<void> | null = null;

export type LogoutOptions = {
  queryClient: QueryClient;
  navigate: NavigateFunction;
  clearAuthState: () => void;
};

async function signOutWithTimeout(): Promise<void> {
  try {
    await Promise.race([
      supabase.auth.signOut(),
      new Promise<void>((_, reject) => {
        window.setTimeout(() => reject(new Error("signOut timeout")), SIGN_OUT_TIMEOUT_MS);
      }),
    ]);
  } catch (err) {
    logAuthLifecycle("LOGOUT_SIGNOUT_TIMEOUT", {
      message: err instanceof Error ? err.message : "unknown",
    });
  }
}

/**
 * Full session teardown. Clears local auth immediately, then stops transport/queries, then Supabase signOut.
 */
export async function logout({ queryClient, navigate, clearAuthState }: LogoutOptions): Promise<void> {
  if (logoutInFlight) {
    return logoutInFlight;
  }

  logAuthLifecycle("LOGOUT_START");

  logoutInFlight = (async () => {
    clearAuthState();
    shutdownRealtimeSession();
    await queryClient.cancelQueries();
    queryClient.clear();
    resetOrchestrationRegistry();
    await signOutWithTimeout();
    navigate("/login", { replace: true });
    logAuthLifecycle("LOGOUT_COMPLETE");
  })();

  try {
    await logoutInFlight;
  } finally {
    logoutInFlight = null;
  }
}
