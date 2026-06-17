/**
 * Copy to app.config.js and fill values from client/.env
 * (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
 *
 * DEFAULT_API_BASE is only a fallback used before the first connect — the live
 * API base is provided by the website during the connect handshake. Flip
 * ENVIRONMENT to "production" (and set the production apiBase) for hosted builds.
 */

const ENVIRONMENT = "development";

const ENVIRONMENTS = {
  development: {
    apiBase: "http://localhost:5000",
    webBase: "http://localhost:5173",
  },
  production: {
    apiBase: "https://ai-apply-jwan.onrender.com",
    webBase: "https://onetap-ai-apply.vercel.app",
  },
};

export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";

export const DEFAULT_API_BASE = ENVIRONMENTS[ENVIRONMENT].apiBase;
export const DEFAULT_WEB_BASE = ENVIRONMENTS[ENVIRONMENT].webBase;

export const TOKEN_REFRESH_BUFFER_SEC = 60;
export const REFRESH_ALARM_MINUTES = 50;
