import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { setCachedAccessToken, supabase } from "@/lib/supabaseClient";
import { api } from "@/lib/api";
import { logAuthLifecycle } from "@/auth/authLifecycleLog";

export type AuthUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  applyMode?: "auto_apply" | "review_apply";
  subscriptionTier?: string;
  subscriptionStatus?: "inactive" | "active";
  subscriptionPlanId?: string | null;
  isAdmin?: boolean;
  flags?: Record<string, unknown>;
};

const AUTH_HYDRATE_TIMEOUT_MS = 12_000;

type AuthContextValue = {
  user: AuthUser | null;
  session: Session | null;
  /** True until first auth hydration completes (session known). */
  isLoading: boolean;
  /** True after hydration finishes — safe to run session-gated queries. */
  isResolved: boolean;
  refreshUser: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  /** Immediate local teardown (does not call Supabase signOut). */
  clearAuthState: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMe(): Promise<AuthUser | null> {
  try {
    const res = await api.getMe();
    logAuthLifecycle("FETCH_ME_SUCCESS", { userId: res.data.id });
    const ref = sessionStorage.getItem("referral_code");
    if (ref) {
      try {
        await api.attachReferral(ref);
        sessionStorage.removeItem("referral_code");
      } catch {
        /* best-effort */
      }
    }
    return res.data;
  } catch (err) {
    logAuthLifecycle("FETCH_ME_FAILED", {
      message: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}

function shouldSyncUserOnAuthEvent(event: AuthChangeEvent) {
  return event === "SIGNED_IN" || event === "TOKEN_REFRESHED";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isResolved, setIsResolved] = useState(false);
  const resolvedRef = useRef(false);
  const mountedRef = useRef(true);

  const finalizeHydration = useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setIsResolved(true);
    logAuthLifecycle("AUTH_LOADING_END");
  }, []);

  const clearAuthState = useCallback(() => {
    logAuthLifecycle("SESSION_NULL");
    setSession(null);
    setUser(null);
    setCachedAccessToken(null);
    finalizeHydration();
  }, [finalizeHydration]);

  const refreshUser = useCallback(async () => {
    const me = await fetchMe();
    if (mountedRef.current) {
      setUser(me);
    }
  }, []);

  const applySession = useCallback(
    (nextSession: Session | null) => {
      setSession(nextSession);
      setCachedAccessToken(nextSession?.access_token ?? null);
      if (nextSession) {
        logAuthLifecycle("SESSION_RESTORED", { userId: nextSession.user.id });
      }
    },
    []
  );

  useEffect(() => {
    mountedRef.current = true;
    resolvedRef.current = false;
    setIsResolved(false);
    logAuthLifecycle("AUTH_LOADING_START");

    const hydrateTimeout = window.setTimeout(() => {
      if (!mountedRef.current || resolvedRef.current) return;
      logAuthLifecycle("AUTH_HYDRATE_TIMEOUT", { timeoutMs: AUTH_HYDRATE_TIMEOUT_MS });
      finalizeHydration();
    }, AUTH_HYDRATE_TIMEOUT_MS);

    const bootstrap = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mountedRef.current) return;
        if (error) {
          logAuthLifecycle("AUTH_STATE_CHANGE", { event: "GET_SESSION_ERROR", message: error.message });
          clearAuthState();
          return;
        }
        applySession(data.session);
        if (data.session) {
          finalizeHydration();
          void refreshUser();
        } else {
          setUser(null);
          finalizeHydration();
        }
      } catch (err) {
        if (!mountedRef.current) return;
        logAuthLifecycle("AUTH_STATE_CHANGE", {
          event: "GET_SESSION_THROW",
          message: err instanceof Error ? err.message : "unknown",
        });
        clearAuthState();
      }
    };

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mountedRef.current) return;

      logAuthLifecycle("AUTH_STATE_CHANGE", {
        event,
        hasSession: Boolean(nextSession),
      });

      // Initial session is applied in bootstrap(); avoid duplicate fetchMe + Supabase lock contention.
      if (event === "INITIAL_SESSION") {
        return;
      }

      applySession(nextSession);

      if (!nextSession) {
        setUser(null);
        finalizeHydration();
        return;
      }

      if (shouldSyncUserOnAuthEvent(event)) {
        void refreshUser();
      }
    });

    return () => {
      mountedRef.current = false;
      window.clearTimeout(hydrateTimeout);
      subscription.unsubscribe();
    };
  }, [applySession, clearAuthState, finalizeHydration, refreshUser]);

  const value = useMemo(
    () => ({
      user,
      session,
      isLoading: !isResolved,
      isResolved,
      refreshUser,
      setUser,
      clearAuthState,
    }),
    [user, session, isResolved, refreshUser, clearAuthState]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export function useAuthReady() {
  const { isResolved, session } = useAuth();
  return { isResolved, session, isAuthenticated: isResolved && Boolean(session) };
}

export function useAuthUserEmail() {
  return useAuth().user?.email;
}

export function useAuthSession() {
  return useAuth().session;
}
