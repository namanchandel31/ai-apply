import { trackProduct } from "./track";

export type LandingCtaId =
  | "hero_start_free"
  | "hero_watch_demo"
  | "nav_get_started"
  | "nav_sign_in"
  | "pricing_subscribe"
  | "extension_install"
  | "footer_sign_in";

export function trackLandingCtaEngaged(cta_id: LandingCtaId, destination: string) {
  trackProduct("landing_cta_engaged", {
    cta_id,
    destination,
    variant: "default",
    experiment_name: null,
  });
}

export function trackLandingSectionViewed(section: string) {
  trackProduct("landing_section_viewed", { section });
}

export function trackLandingScrollDepth(depth_percent: 25 | 50 | 75 | 100) {
  trackProduct("landing_scroll_depth_reached", { depth_percent });
}

export function trackLandingFaqExpanded(question_id: string) {
  trackProduct("landing_faq_expanded", { question_id });
}
