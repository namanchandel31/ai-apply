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

export function QuotaPaywall() {
  const navigate = useNavigate();
  const [ctx, setCtx] = useState<QuotaExceededContext | null>(null);

  useEffect(() => {
    setQuotaExceededHandler((next) => setCtx(next));
    return () => setQuotaExceededHandler(null);
  }, []);

  const open = ctx !== null;
  const isApplicationQuota = ctx?.feature === "quota_applications_sent";
  const hasCount = typeof ctx?.limit === "number" && ctx.limit >= 0;
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
          <DialogTitle>
            {isApplicationQuota ? "Trial applications used up" : "You've reached your plan limit"}
          </DialogTitle>
          <DialogDescription>
            {isApplicationQuota ? (
              <>
                You've sent {ctx?.used ?? 0} of {ctx?.limit ?? 0} trial applications.
                Choose how you'd like to continue.
              </>
            ) : (
              <>
                You've used all of your allowance
                {hasCount ? ` (${ctx?.used} of ${ctx?.limit})` : ""}.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 pt-2">
          {canUpgrade && isApplicationQuota && (
            <>
              <Button
                onClick={() => {
                  setCtx(null);
                  navigate("/pricing?plan=managed");
                }}
              >
                Upgrade to OneTap AI
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setCtx(null);
                  navigate("/pricing?plan=byok");
                }}
              >
                Upgrade to BYOK
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setCtx(null);
                  navigate("/dashboard?share=referral");
                }}
              >
                Refer friends for bonus sends
              </Button>
            </>
          )}
          {canUpgrade && !isApplicationQuota && (
            <Button
              onClick={() => {
                setCtx(null);
                navigate("/pricing");
              }}
            >
              View plans
            </Button>
          )}
          <Button variant="ghost" onClick={() => setCtx(null)}>
            Not now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
