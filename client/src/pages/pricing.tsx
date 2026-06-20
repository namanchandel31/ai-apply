import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BILLING_PLANS, type PlanId } from "@/lib/billingPlans";
import { loadRazorpayCheckout } from "@/lib/loadRazorpayCheckout";
import { api } from "@/lib/api";

export function PricingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const [activePlan, setActivePlan] = useState<PlanId | null>(null);

  const prefillName = useMemo(() => {
    if (user?.fullName?.trim()) return user.fullName.trim();
    const composed = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
    return composed || undefined;
  }, [user?.firstName, user?.fullName, user?.lastName]);

  const handleSubscribe = async (planId: PlanId) => {
    setActivePlan(planId);
    try {
      const scriptLoaded = await loadRazorpayCheckout();
      if (!scriptLoaded || !window.Razorpay) {
        toast.error("Unable to load payment checkout");
        return;
      }

      const orderRes = await api.createBillingOrder(planId);
      const { keyId, orderId, amountPaise, currency, plan } = orderRes.data;

      const razorpay = new window.Razorpay({
        key: keyId,
        order_id: orderId,
        amount: amountPaise,
        currency,
        name: "OneTap",
        description: `${plan.name} subscription`,
        prefill: {
          name: prefillName,
          email: user?.email,
        },
        theme: { color: "#2563eb" },
        handler: (response) => {
          void (async () => {
            try {
              await api.verifyBillingPayment({
                planId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              await refreshUser();
              await queryClient.invalidateQueries({ queryKey: ["setup-status"] });
              toast.success("Payment successful. Your account is now active.");
              navigate("/onboarding", { replace: true });
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Payment verification failed");
            } finally {
              setActivePlan(null);
            }
          })();
        },
        modal: {
          ondismiss: () => setActivePlan(null),
        },
      });

      razorpay.open();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start payment");
      setActivePlan(null);
    }
  };

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
          {BILLING_PLANS.map((plan) => {
            const isLoading = activePlan === plan.id;
            return (
              <Card key={plan.id} className={plan.highlighted ? "border-primary/40" : undefined}>
                <CardContent className="flex h-full flex-col p-6">
                  <p className="text-sm font-medium text-muted-foreground">{plan.badge}</p>
                  <h2 className="mt-2 text-2xl font-semibold text-foreground">{plan.name}</h2>
                  <p className="mt-2 text-3xl font-semibold text-foreground">
                    {plan.price} <span className="text-base font-normal text-muted-foreground">{plan.priceNote}</span>
                  </p>
                  <p className="mt-4 text-sm text-muted-foreground">{plan.summary}</p>
                  <ul className="mt-5 flex-1 space-y-2 text-sm text-foreground">
                    {plan.features.map((feature) => (
                      <li key={feature}>• {feature}</li>
                    ))}
                  </ul>
                  <Button
                    type="button"
                    className="mt-6 h-11 w-full"
                    variant={plan.highlighted ? "default" : "outline"}
                    disabled={Boolean(activePlan)}
                    onClick={() => void handleSubscribe(plan.id)}
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Subscribe
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
