import { API_BASE_URL } from "@/lib/apiBase";
import { getAttribution, getWorkflowId } from "@/lib/analytics";
import { getSupabaseAccessToken } from "@/lib/supabaseClient";

const debugAuth =
  import.meta.env.DEV || import.meta.env.VITE_DEBUG_AUTH === "1";

function logAuthRequestDebug(path: string, hasToken: boolean, apiBase: string) {
  if (!debugAuth) return;
  console.info("[auth:api]", {
    path,
    hasToken,
    apiBase: apiBase || "(relative — dev proxy)",
  });
}

/**
 * Build fetch headers with a fresh Supabase Bearer token when a session exists.
 */
export async function buildAuthorizedHeaders(init?: HeadersInit): Promise<{
  headers: Headers;
  hasToken: boolean;
}> {
  const headers = new Headers(init);
  const token = await getSupabaseAccessToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  headers.set("X-Workflow-Id", getWorkflowId());
  const attribution = getAttribution();
  if (attribution.utm_source) headers.set("X-Utm-Source", attribution.utm_source);
  if (attribution.utm_medium) headers.set("X-Utm-Medium", attribution.utm_medium);
  if (attribution.utm_campaign) headers.set("X-Utm-Campaign", attribution.utm_campaign);
  if (attribution.referral_code) headers.set("X-Referral-Code", attribution.referral_code);

  return { headers, hasToken: Boolean(token) };
}

export function warnIfProductionApiMisconfigured(path: string) {
  if (import.meta.env.PROD && !API_BASE_URL) {
    console.error(
      `[auth:api] VITE_API_URL is not set — "${path}" will request the Vercel origin, not Render. ` +
        "Set VITE_API_URL to your backend URL in Vercel environment variables."
    );
  }
}

export function logAuthRequest(path: string, hasToken: boolean) {
  warnIfProductionApiMisconfigured(path);
  logAuthRequestDebug(path, hasToken, API_BASE_URL);
}
