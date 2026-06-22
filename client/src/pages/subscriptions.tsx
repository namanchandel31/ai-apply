import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";
import { SetupPageShell } from "@/components/layout/SetupPageShell";
import { TrialUsageProgress } from "@/components/TrialUsageProgress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  api,
  type BillingEntitlement,
  type BillingOrder,
  type PricingPlan,
  type SetupStatusData,
  type SubscriptionStatusData,
} from "@/lib/api";
import { loadRazorpayCheckout } from "@/lib/loadRazorpayCheckout";
import { mergeSetupStatusWithEntitlement } from "@/lib/paywallRouting";
import {
  formatMoney,
  formatSubscriptionDate,
  getPlanDisplayName,
  getSubscriptionStatusLabel,
} from "@/lib/subscriptionDisplay";
import { cn } from "@/lib/utils";
import { setupStatusQueryOptions } from "@/queries/bootstrapQueries";

function trialCampaign(plan: PricingPlan) {
  return plan.campaigns.find((c) => c.type === "trial") ?? null;
}

function orderStatusLabel(status: string) {
  switch (status) {
    case "captured":
      return "Paid";
    case "failed":
      return "Failed";
    case "refunded":
      return "Refunded";
    default:
      return status;
  }
}

export function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatusData | null>(null);
  const [orders, setOrders] = useState<BillingOrder[]>([]);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [checkoutEnabled, setCheckoutEnabled] = useState(true);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const loadPage = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, ordersRes, pricingRes] = await Promise.all([
        api.getSubscriptionStatus(),
        api.getBillingOrders(),
        api.getPricing(),
      ]);
      setSubscriptionStatus(statusRes.data);
      setOrders(ordersRes.data.orders);
      setPlans([...(pricingRes.data.plans ?? [])].sort((a, b) => a.sortOrder - b.sortOrder));
      setCheckoutEnabled(pricingRes.data.paywall.checkoutEnabled);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load subscription details");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const prefillName = useMemo(() => {
    if (user?.fullName?.trim()) return user.fullName.trim();
    const composed = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
    return composed || undefined;
  }, [user?.firstName, user?.fullName, user?.lastName]);

  const refreshAfterActivation = async (entitlement?: BillingEntitlement) => {
    if (entitlement) {
      queryClient.setQueryData(setupStatusQueryOptions.queryKey, (prev: SetupStatusData | undefined) =>
        mergeSetupStatusWithEntitlement(prev, entitlement)
      );
    }
    await refreshUser();
    await queryClient.refetchQueries({ queryKey: setupStatusQueryOptions.queryKey });
    await loadPage();
  };

  const handleClaimTrial = async (plan: PricingPlan) => {
    const campaign = trialCampaign(plan);
    if (!campaign?.code) return;
    setActiveSlug(plan.slug);
    try {
      const res = await api.claimTrial({ campaignCode: campaign.code, planSlug: plan.slug });
      toast.success("Free trial started");
      await refreshAfterActivation(res.data.entitlement);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start trial");
    } finally {
      setActiveSlug(null);
    }
  };

  const handleSubscribe = async (plan: PricingPlan) => {
    const pricePoint = plan.pricePoints[0];
    if (!pricePoint) {
      toast.error("This plan has no price configured yet");
      return;
    }
    setActiveSlug(plan.slug);
    try {
      const scriptLoaded = await loadRazorpayCheckout();
      if (!scriptLoaded || !window.Razorpay) {
        toast.error("Unable to load payment checkout");
        return;
      }

      const discountCampaign = plan.campaigns.find((c) => c.type === "discount");
      const orderRes = await api.createCheckout({
        planSlug: plan.slug,
        pricePointId: pricePoint.id,
        campaignCode: discountCampaign?.code ?? undefined,
      });
      const { keyId, orderId, amountPaise, currency, plan: orderPlan } = orderRes.data;

      const razorpay = new window.Razorpay({
        key: keyId,
        order_id: orderId,
        amount: amountPaise,
        currency,
        name: "OneTap",
        description: `${orderPlan.displayName} subscription`,
        prefill: { name: prefillName, email: user?.email },
        theme: { color: "#2563eb" },
        handler: (response) => {
          void (async () => {
            try {
              const verifyRes = await api.verifyBillingPayment({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              toast.success("Subscription activated");
              await refreshAfterActivation(verifyRes.data.entitlement);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Payment verification failed");
            } finally {
              setActiveSlug(null);
            }
          })();
        },
        modal: { ondismiss: () => setActiveSlug(null) },
      });

      razorpay.open();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start payment");
      setActiveSlug(null);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await api.cancelSubscription(false);
      toast.success("Subscription will cancel at the end of the current period");
      await loadPage();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel subscription");
    } finally {
      setCancelling(false);
    }
  };

  const subscription = subscriptionStatus?.subscription;
  const planName = getPlanDisplayName(subscription?.planSlug, subscription?.planDisplayName);
  const showTrialUsage =
    subscription?.status === "trialing" ||
    (subscriptionStatus?.paywallEnabled && !subscriptionStatus.entitled);

  return (
    <SetupPageShell
      title="Subscription"
      description="Manage your plan, renewals, and billing history."
      contentClassName="max-w-4xl"
    >
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="plan" className="gap-6">
          <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-b border-border bg-transparent p-0">
            <TabsTrigger
              value="plan"
              className="rounded-none border-b-2 border-transparent px-0 pb-3 pt-0 text-base data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Current plan
            </TabsTrigger>
            <TabsTrigger
              value="orders"
              className="rounded-none border-b-2 border-transparent px-0 pb-3 pt-0 text-base data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Order history ({orders.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="plan" className="mt-0 space-y-6">
            {subscription ? (
              <Card className="border border-border shadow-none">
                <CardContent className="space-y-4 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Current plan</p>
                      <h2 className="mt-1 text-2xl font-semibold text-foreground">
                        {planName ?? "OneTap plan"}
                      </h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {getSubscriptionStatusLabel(subscription)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium",
                        subscription.status === "trialing"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-blue-50 text-blue-700"
                      )}
                    >
                      {subscription.status === "trialing" ? "Free trial" : "Subscribed"}
                    </span>
                  </div>

                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-md border border-border bg-muted/20 px-4 py-3">
                      <p className="text-muted-foreground">Access starts</p>
                      <p className="mt-1 font-medium">
                        {formatSubscriptionDate(subscription.accessStartsAt)}
                      </p>
                    </div>
                    <div className="rounded-md border border-border bg-muted/20 px-4 py-3">
                      <p className="text-muted-foreground">
                        {subscription.cancelAtPeriodEnd ? "Access ends" : "Renews / ends"}
                      </p>
                      <p className="mt-1 font-medium">
                        {formatSubscriptionDate(subscription.accessEndsAt)}
                      </p>
                    </div>
                  </div>

                  {subscription.cancelAtPeriodEnd ? (
                    <p className="text-sm text-muted-foreground">
                      Your subscription is set to cancel at the end of the current period.
                    </p>
                  ) : subscription.status === "active" ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={cancelling}
                      onClick={() => void handleCancel()}
                    >
                      {cancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Cancel at period end
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ) : (
              <Card className="border border-border shadow-none">
                <CardContent className="space-y-4 p-6">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">No active subscription</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Choose a plan below to unlock full access to OneTap.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {showTrialUsage ? <TrialUsageProgress /> : null}

            {!subscription || subscription.status !== "active" ? (
              <div className="space-y-4">
                <h3 className="text-base font-medium text-foreground">
                  {subscription ? "Upgrade or switch plan" : "Choose a plan"}
                </h3>
                <div className="grid gap-5 md:grid-cols-2">
                  {plans.map((plan) => {
                    const isLoading = activeSlug === plan.slug;
                    const pricePoint = plan.pricePoints[0];
                    const trial = trialCampaign(plan);
                    const discount = plan.campaigns.find((c) => c.type === "discount");
                    return (
                      <Card key={plan.slug} className={plan.popular ? "border-primary/40" : undefined}>
                        <CardContent className="flex h-full flex-col p-6">
                          <div className="flex items-center gap-2">
                            {plan.popular ? (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                Most popular
                              </span>
                            ) : null}
                            {trial ? (
                              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
                                {trial.trialDays}-day free trial
                              </span>
                            ) : null}
                            {discount ? (
                              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600">
                                {discount.discountType === "percent"
                                  ? `${discount.discountAmount}% off`
                                  : "Discount"}
                              </span>
                            ) : null}
                          </div>
                          <h4 className="mt-3 text-xl font-semibold text-foreground">{plan.displayName}</h4>
                          <p className="mt-2 text-2xl font-semibold text-foreground">
                            {pricePoint ? formatMoney(pricePoint.amountPaise, pricePoint.currency) : "-"}{" "}
                            <span className="text-base font-normal text-muted-foreground">
                              {pricePoint ? `/ ${pricePoint.durationDays} days` : ""}
                            </span>
                          </p>
                          {plan.description ? (
                            <p className="mt-3 text-sm text-muted-foreground">{plan.description}</p>
                          ) : null}
                          <ul className="mt-4 flex-1 space-y-2 text-sm text-foreground">
                            {plan.features.map((feature) => (
                              <li key={feature.label} className="flex items-center gap-2">
                                {feature.included ? (
                                  <Check className="h-4 w-4 text-emerald-600" />
                                ) : (
                                  <X className="h-4 w-4 text-muted-foreground/50" />
                                )}
                                <span className={feature.included ? "" : "text-muted-foreground/60"}>
                                  {feature.label}
                                </span>
                              </li>
                            ))}
                          </ul>

                          {trial?.code && subscription?.status !== "active" ? (
                            <Button
                              type="button"
                              className="mt-5 h-11 w-full"
                              variant={plan.popular ? "default" : "outline"}
                              disabled={Boolean(activeSlug)}
                              onClick={() => void handleClaimTrial(plan)}
                            >
                              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              Start {trial.trialDays}-day free trial
                            </Button>
                          ) : checkoutEnabled ? (
                            <Button
                              type="button"
                              className="mt-5 h-11 w-full"
                              variant={plan.popular ? "default" : "outline"}
                              disabled={Boolean(activeSlug)}
                              onClick={() => void handleSubscribe(plan)}
                            >
                              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              Subscribe
                            </Button>
                          ) : (
                            <p className="mt-5 text-sm text-muted-foreground">Checkout is currently unavailable.</p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="orders" className="mt-0">
            <Card className="border border-border shadow-none">
              <CardContent className="p-0">
                {orders.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">No orders yet.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {orders.map((order) => (
                      <li key={order.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {getPlanDisplayName(order.planSlug, order.planDisplayName) ?? "OneTap plan"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatSubscriptionDate(order.capturedAt ?? order.createdAt)}
                            {order.razorpayOrderId ? ` · ${order.razorpayOrderId}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-sm font-medium tabular-nums">
                            {formatMoney(order.amountPaise, order.currency)}
                          </span>
                          <span className="text-xs text-muted-foreground">{orderStatusLabel(order.status)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </SetupPageShell>
  );
}
