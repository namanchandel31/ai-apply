import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import {
  capturePageView,
  identifyAnalyticsUser,
  initPostHog,
  resetAnalyticsUser,
  setAnalyticsContext,
  trackProduct,
} from "./track";
import { captureAttributionFromUrl, getWorkflowId } from "./attribution";
import { resolvePageName } from "./pageNames";
import type { OnboardingEventName } from "@/lib/onboardingEvents";

type OnboardingBusDetail = {
  name: OnboardingEventName;
  props?: Record<string, string | boolean | number>;
};

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user, session } = useAuth();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    captureAttributionFromUrl(location.search);
  }, [location.search]);

  useEffect(() => {
    const page_name = resolvePageName(location.pathname);
    setAnalyticsContext({
      page_name,
      page_path: location.pathname + location.search,
      workflow_id: getWorkflowId(),
      authenticated: Boolean(session),
    });
    capturePageView(location.pathname, location.search);

    if (page_name === "pricing") {
      trackProduct("pricing_viewed", { pricing_version: "v1" });
    }
  }, [location.pathname, location.search, session]);

  useEffect(() => {
    if (user) {
      identifyAnalyticsUser(user);
    } else if (!session) {
      resetAnalyticsUser();
    }
  }, [user, session]);

  useEffect(() => {
    const onOnboarding = (event: Event) => {
      const detail = (event as CustomEvent<OnboardingBusDetail>).detail;
      if (!detail?.name) return;
      trackProduct(detail.name, detail.props ?? {});
    };
    window.addEventListener("onetap:onboarding", onOnboarding);
    return () => window.removeEventListener("onetap:onboarding", onOnboarding);
  }, []);

  return children;
}
