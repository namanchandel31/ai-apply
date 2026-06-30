import posthog from "posthog-js";
import type { AuthUser } from "@/auth/AuthContext";
import type { AnalyticsContext, EventTier, TrackOptions } from "./types";
import { getAttribution } from "./attribution";

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || "/ingest";
const UI_HOST = import.meta.env.VITE_POSTHOG_UI_HOST as string | undefined;

let initialized = false;
let context: AnalyticsContext = { authenticated: false };

export function initPostHog() {
  if (initialized || !KEY || typeof window === "undefined") return;
  posthog.init(KEY, {
    api_host: HOST,
    ui_host: UI_HOST,
    autocapture: true,
    capture_pageview: false,
    capture_pageleave: true,
    disable_session_recording: true,
    person_profiles: "identified_only",
    persistence: "localStorage+cookie",
  });
  const attribution = getAttribution();
  if (Object.keys(attribution).length > 0) {
    posthog.register(attribution);
  }
  initialized = true;
}

export function isPostHogReady() {
  return initialized && Boolean(KEY);
}

export function setAnalyticsContext(patch: Partial<AnalyticsContext>) {
  context = { ...context, ...patch };
}

export function identifyAnalyticsUser(user: AuthUser) {
  if (!isPostHogReady()) return;
  posthog.identify(user.id, {
    email: user.email,
    subscription_tier: user.subscriptionTier,
    subscription_status: user.subscriptionStatus,
    apply_mode: user.applyMode,
    plan_id: user.subscriptionPlanId,
    ...getAttribution(),
  });
  setAnalyticsContext({
    authenticated: true,
    subscription_tier: user.subscriptionTier,
  });
}

export function resetAnalyticsUser() {
  if (!isPostHogReady()) return;
  posthog.reset();
  setAnalyticsContext({ authenticated: false, subscription_tier: undefined });
}

function baseProps(extra: Record<string, unknown> = {}) {
  return {
    app_version: import.meta.env.VITE_APP_VERSION || "0.0.0",
    environment: import.meta.env.PROD ? "production" : "development",
    platform: "web",
    authenticated: context.authenticated,
    subscription_tier: context.subscription_tier,
    page_name: context.page_name,
    page_path: context.page_path,
    workflow_id: context.workflow_id,
    session_id: posthog.get_session_id?.(),
    distinct_id: posthog.get_distinct_id?.(),
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

export function trackEvent(
  event: string,
  properties: Record<string, unknown> = {},
  options: TrackOptions = {}
) {
  if (!isPostHogReady()) {
    if (import.meta.env.DEV) {
      console.info("[analytics]", event, properties);
    }
    return;
  }
  const tier: EventTier = options.tier ?? "product";
  posthog.capture(event, {
    ...baseProps(properties),
    event_tier: tier,
    schema_version: options.schema_version,
  });
}

export function trackBusiness(event: string, properties: Record<string, unknown> = {}) {
  trackEvent(event, properties, { tier: "business", schema_version: 1 });
}

export function trackProduct(event: string, properties: Record<string, unknown> = {}) {
  trackEvent(event, properties, { tier: "product" });
}

export function trackOperational(event: string, properties: Record<string, unknown> = {}) {
  trackEvent(event, properties, { tier: "operational" });
}

export function capturePageView(pathname: string, search: string) {
  if (!isPostHogReady()) return;
  const page_name = context.page_name;
  posthog.capture("$pageview", baseProps({ page_name, page_path: pathname + search }));
}

export { posthog };
