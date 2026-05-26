import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  console.warn(
    "[auth] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set for Google sign-in"
  );
}

export const supabase = createClient(url ?? "", anonKey ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** Sync mirror updated by AuthProvider for transport gating (no localStorage reads elsewhere). */
let cachedAccessToken: string | null = null;

const TOKEN_REFRESH_BUFFER_SEC = 60;

export function setCachedAccessToken(token: string | null): void {
  cachedAccessToken = token?.trim() || null;
}

export function getCachedAccessToken(): string | null {
  return cachedAccessToken;
}

function sessionNeedsRefresh(session: { expires_at?: number } | null): boolean {
  if (!session?.expires_at) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  return session.expires_at - nowSec < TOKEN_REFRESH_BUFFER_SEC;
}

/**
 * Always read the current Supabase session (not a stale cache).
 * Refreshes when the access token is near expiry.
 */
export async function getSupabaseAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    setCachedAccessToken(null);
    return null;
  }

  let session = data.session;
  if (!session?.access_token) {
    setCachedAccessToken(null);
    return null;
  }

  if (sessionNeedsRefresh(session)) {
    const refreshed = await supabase.auth.refreshSession();
    if (!refreshed.error && refreshed.data.session?.access_token) {
      session = refreshed.data.session;
    }
  }

  const token = session.access_token.trim();
  setCachedAccessToken(token);
  return token;
}
