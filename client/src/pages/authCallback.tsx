import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

const CALLBACK_TIMEOUT_MS = 15_000;

function stripOAuthHashFromUrl() {
  if (!window.location.hash) return;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}

function isSessionReadyEvent(event: AuthChangeEvent) {
  return event === "SIGNED_IN" || event === "INITIAL_SESSION";
}

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const redirectedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const redirect = (path: "/dashboard" | "/login") => {
      if (!mounted || redirectedRef.current) return;
      redirectedRef.current = true;
      navigate(path, { replace: true });
    };

    const completeWithSession = (session: Session) => {
      if (!session) return;
      stripOAuthHashFromUrl();
      redirect("/dashboard");
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted || redirectedRef.current) return;
      if (session && isSessionReadyEvent(event)) {
        completeWithSession(session);
      }
    });

    void (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted || redirectedRef.current) return;
      if (error) {
        redirect("/login");
        return;
      }
      if (data.session) {
        completeWithSession(data.session);
      }
    })();

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        if (!mounted || redirectedRef.current) return;
        const { data } = await supabase.auth.getSession();
        if (!mounted || redirectedRef.current) return;
        if (data.session) {
          completeWithSession(data.session);
        } else {
          redirect("/login");
        }
      })();
    }, CALLBACK_TIMEOUT_MS);

    return () => {
      mounted = false;
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
