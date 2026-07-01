import type { SetupStatusData } from "@/lib/api";
import { isPricingEnabled } from "@/lib/featureFlags";
import { isOnboardingFlowComplete } from "@/lib/onboardingFlow";

/** Client env may show pricing UI, but server pricingEnabled is authoritative for gates. */
export function shouldEnforceSubscriptionPaywall(status?: SetupStatusData | null): boolean {
  if (!isPricingEnabled) return false;
  if (status?.pricingEnabled === false) return false;
  return true;
}

export type PaywallTrigger = "after_plan_selection" | "after_onboarding" | "before_first_apply";

export type EntitlementSnapshot = {
  entitled?: boolean;
  planSlug?: string | null;
  status?: string;
  accessEndsAt?: string | null;
  entitlements?: SetupStatusData["entitlements"];
};

/** Whether an unsubscribed user must pay before visiting this path. */
export function shouldRequireSubscriptionForPath(
  trigger: PaywallTrigger | undefined,
  pathname: string
): boolean {
  if (trigger === "before_first_apply") return false;
  if (pathname.startsWith("/referrals")) return false;
  if (pathname.startsWith("/subscriptions")) return false;
  if (trigger === "after_onboarding") {
    return !pathname.startsWith("/onboarding");
  }
  return true;
}

/** Post-auth / home redirect when the user has no active subscription. */
export function postAuthPathWithoutSubscription(status: SetupStatusData): "/subscriptions" | "/onboarding" | "/dashboard" {
  const trigger = status.paywallTrigger;
  if (trigger === "before_first_apply" || trigger === "after_onboarding") {
    return isOnboardingFlowComplete(status) ? "/dashboard" : "/onboarding";
  }
  return "/subscriptions";
}

export function mergeSetupStatusWithEntitlement(
  prev: SetupStatusData | undefined,
  entitlement: EntitlementSnapshot
): SetupStatusData {
  const base = prev ?? ({} as SetupStatusData);
  return {
    ...base,
    hasActiveSubscription: Boolean(entitlement.entitled),
    planSlug: entitlement.planSlug ?? base.planSlug ?? null,
    subscriptionState: entitlement.status ?? base.subscriptionState,
    accessEndsAt: entitlement.accessEndsAt ?? base.accessEndsAt ?? null,
    entitlements: entitlement.entitlements ?? base.entitlements,
  };
}
