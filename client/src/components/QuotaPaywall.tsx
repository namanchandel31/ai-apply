import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setQuotaExceededHandler, type QuotaExceededContext } from "@/lib/api";
import { isPricingEnabled } from "@/lib/featureFlags";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Global paywall surface. The API client dispatches a QUOTA_EXCEEDED context (feature +
 * limit/used/remaining + upgrade eligibility) on any 402 from a credit-gated endpoint, so
 * we can render the paywall and route to pricing without an extra request. Mounted once
 * near the app root; any action that exhausts an allowance triggers it automatically.
 */
const FEATURE_LABELS: Record<string, string> = {
  quota_resumes_parsed: "resume parses",
  quota_jds_parsed: "job description parses",
  quota_emails_generated: "AI email generations",
  quota_applications_sent: "application sends",
};

export function QuotaPaywall() {
  const navigate = useNavigate();
  const [ctx, setCtx] = useState<QuotaExceededContext | null>(null);

  useEffect(() => {
    setQuotaExceededHandler((next) => setCtx(next));
    return () => setQuotaExceededHandler(null);
  }, []);

  const open = ctx !== null;
  const label = (ctx?.feature && FEATURE_LABELS[ctx.feature]) || "this feature";
  const hasCount = typeof ctx?.limit === "number" && ctx.limit >= 0;
  const used = typeof ctx?.used === "number" ? ctx.used : ctx?.limit;
  const canUpgrade = ctx?.upgradeEligible !== false && isPricingEnabled;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setCtx(null);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>You've reached your plan limit</DialogTitle>
          <DialogDescription>
            You've used all of your {label}
            {hasCount ? ` (${used} of ${ctx?.limit})` : ""}.{" "}
            {canUpgrade
              ? "Upgrade your plan to keep going."
              : "Your plan limit for this action has been reached."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setCtx(null)}>
            Not now
          </Button>
          {canUpgrade && (
            <Button
              onClick={() => {
                setCtx(null);
                navigate("/pricing");
              }}
            >
              View plans
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
