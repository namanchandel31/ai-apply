import { useMemo, useState } from "react";
import { Loader2, Check, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { loadRazorpayCheckout } from "@/lib/loadRazorpayCheckout";
import { api, type PricingPlan } from "@/lib/api";

function formatAmount(amountPaise: number, currency: string) {
  const value = amountPaise / 100;
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

function trialCampaign(plan: PricingPlan) {
  return plan.campaigns.find((c) => c.type === "trial") ?? null;
}

export function PricingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  const pricingQuery = useQuery({
    queryKey: ["pricing"],
    queryFn: () => api.getPricing(),
  });

  const prefillName = useMemo(() => {
    if (user?.fullName?.trim()) return user.fullName.trim();
    const composed = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
    return composed || undefined;
  }, [user?.firstName, user?.fullName, user?.lastName]);

  const goAfterActivation = async () => {
    await refreshUser();
    await queryClient.invalidateQueries({ queryKey: ["setup-status"] });
    toast.success("You're all set. Continuing to onboarding.");
    navigate("/onboarding", { replace: true });
  };

  const handleClaimTrial = async (plan: PricingPlan) => {
    const campaign = trialCampaign(plan);
    if (!campaign?.code) return;
    setActiveSlug(plan.slug);
    try {
      await api.claimTrial({ campaignCode: campaign.code, planSlug: plan.slug });
      await goAfterActivation();
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
              await api.verifyBillingPayment({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              await goAfterActivation();
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

  if (pricingQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const plans = [...(pricingQuery.data?.data.plans ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Choose your plan</h1>
          <p className="mt-2 text-base text-muted-foreground">
            Subscribe to activate your OneTap account and continue to the platform.
          </p>
        </div>

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
                  <h2 className="mt-3 text-2xl font-semibold text-foreground">{plan.displayName}</h2>
                  <p className="mt-2 text-3xl font-semibold text-foreground">
                    {pricePoint ? formatAmount(pricePoint.amountPaise, pricePoint.currency) : "—"}{" "}
                    <span className="text-base font-normal text-muted-foreground">
                      {pricePoint ? `/ ${pricePoint.durationDays} days` : ""}
                    </span>
                  </p>
                  {plan.description ? (
                    <p className="mt-4 text-sm text-muted-foreground">{plan.description}</p>
                  ) : null}
                  <ul className="mt-5 flex-1 space-y-2 text-sm text-foreground">
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

                  {trial?.code ? (
                    <Button
                      type="button"
                      className="mt-6 h-11 w-full"
                      variant={plan.popular ? "default" : "outline"}
                      disabled={Boolean(activeSlug)}
                      onClick={() => void handleClaimTrial(plan)}
                    >
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Start {trial.trialDays}-day free trial
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      className="mt-6 h-11 w-full"
                      variant={plan.popular ? "default" : "outline"}
                      disabled={Boolean(activeSlug)}
                      onClick={() => void handleSubscribe(plan)}
                    >
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Subscribe
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
