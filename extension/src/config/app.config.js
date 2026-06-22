/**
 * Extension static config.
 *
 * Supabase URL/anon key are public client config (safe to ship in the bundle).
 * Copy values from client/.env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
 * See extension/README.md.
 *
 * --- Switching environments ---------------------------------------------------
 * `DEFAULT_API_BASE` is only a FALLBACK. The real API base is sent by the website
 * during the connect handshake and stored per-install in chrome.storage.local, so
 * a connected extension already talks to whatever origin the website was served
 * from. This fallback is used only before the first connect (or if storage was
 * cleared). To test/ship non-locally, set ENVIRONMENT to "production" (or override
 * ENVIRONMENTS.production.apiBase) and rebuild.
 */

// Flip to "development" for local testing (localhost:5173 / localhost:5000).
// Use "production" for Chrome Web Store builds (onetapjob.com).
const ENVIRONMENT = "development";

const ENVIRONMENTS = {
  development: {
    apiBase: "http://localhost:5001",
    // Website origin (Vite dev server) the popup opens for dashboard / settings.
    webBase: "http://localhost:5173",
  },
  production: {
    // Backend API origin (Render). Only a fallback — the live value is sent by the
    // website during connect (driven by the site's VITE_API_URL).
    apiBase: "https://ai-apply-jwan.onrender.com",
    // Website origin the popup opens for dashboard / settings.
    webBase: "https://onetapjob.com",
  },
};

export const SUPABASE_URL = "https://ybfzpfouqmdacgfxieec.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InliZnpwZm91cW1kYWNnZnhpZWVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMjkwMDUsImV4cCI6MjA5MTgwNTAwNX0.kTO_BT5uuSfDMeV6ZI8wLyz_Ni6qRitY44DBnt_doPc";

export const DEFAULT_API_BASE = ENVIRONMENTS[ENVIRONMENT].apiBase;
export const DEFAULT_WEB_BASE = ENVIRONMENTS[ENVIRONMENT].webBase;

export const TOKEN_REFRESH_BUFFER_SEC = 60;
export const REFRESH_ALARM_MINUTES = 50;
