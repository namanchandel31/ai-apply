import type { SetupStatusData, SubscriptionDetails } from "@/lib/api";

const FALLBACK_PLAN_NAMES: Record<string, string> = {
  byok: "Bring Your Own AI",
  onetap_llm: "OneTap Managed AI",
};

export function getPlanDisplayName(
  planSlug?: string | null,
  planDisplayName?: string | null
): string | null {
  if (planDisplayName?.trim()) return planDisplayName.trim();
  if (planSlug && FALLBACK_PLAN_NAMES[planSlug]) return FALLBACK_PLAN_NAMES[planSlug];
  return planSlug ?? null;
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
