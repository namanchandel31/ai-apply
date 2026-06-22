import type { SetupStatusData, SubscriptionDetails, SubscriptionStatusData } from "@/lib/api";

const FALLBACK_PLAN_NAMES: Record<string, string> = {
  byok: "Bring Your Own AI",
  onetap_llm: "OneTap Managed AI",
  managed: "OneTap Managed AI",
};

const RECOMMENDED_PLAN_SLUGS = ["managed", "onetap_llm"] as const;

export function isFreeTrialUser(status?: SetupStatusData | null): boolean {
  if (!status) return false;
  if (status.subscriptionState === "trialing") return true;
  if (status.pricingEnabled && !status.hasActiveSubscription) return true;
  return false;
}

export function getPlanDisplayName(
  planSlug?: string | null,
  planDisplayName?: string | null
): string | null {
  if (planDisplayName?.trim()) return planDisplayName.trim();
  if (planSlug && FALLBACK_PLAN_NAMES[planSlug]) return FALLBACK_PLAN_NAMES[planSlug];
  return planSlug ?? null;
}

export function getRecommendedPlanSlug(
  plans: Array<{ slug: string; displayName: string; popular?: boolean }>
): string | null {
  if (plans.length === 0) return null;

  const bySlug = plans.find((plan) =>
    (RECOMMENDED_PLAN_SLUGS as readonly string[]).includes(plan.slug)
  );
  if (bySlug) return bySlug.slug;

  const byName = plans.find((plan) => /managed ai/i.test(plan.displayName));
  if (byName) return byName.slug;

  const popular = plans.find((plan) => plan.popular);
  if (popular) return popular.slug;

  return plans[0]?.slug ?? null;
}

export function getSubscriptionMenuBadge(status?: SetupStatusData | null): string | null {
  if (!status) return null;

  const planName = getPlanDisplayName(status.planSlug);

  if (status.subscriptionState === "trialing") {
    return planName ? `Free trial · ${planName}` : "Free trial";
  }

  if (status.hasActiveSubscription) {
    return planName ?? "Subscribed";
  }

  if (status.pricingEnabled) {
    return "Free trial";
  }

  return null;
}

export function isUsageBasedFreeTrial(status?: SubscriptionStatusData | null): boolean {
  if (!status?.entitled || status.subscription) return false;
  return status.status === "trialing" || status.paywallEnabled;
}

export function formatBillingPeriod(durationDays: number): string {
  if (durationDays === 30 || durationDays === 31) return "/ month";
  if (durationDays === 365 || durationDays === 366) return "/ year";
  return `/ ${durationDays} days`;
}

export function getSubscriptionStatusLabel(subscription?: SubscriptionDetails | null): string {
  if (!subscription) return "No active plan";
  if (subscription.status === "trialing") return "Free trial";
  if (subscription.status === "active") {
    return subscription.cancelAtPeriodEnd ? "Active · Cancels at period end" : "Active";
  }
  return subscription.status;
}

export function formatMoney(amountPaise: number, currency: string) {
  const value = amountPaise / 100;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

export function formatSubscriptionDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
