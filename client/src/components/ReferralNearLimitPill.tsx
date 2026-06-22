import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { api, type UsageSummary } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  onShareClick: () => void;
};

/**
 * Shown when trial application usage crosses ~80% — nudges referral sharing.
 */
export function ReferralNearLimitPill({ className, onShareClick }: Props) {
  const [usage, setUsage] = useState<UsageSummary | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getUsage()
      .then((res) => {
        if (active) setUsage(res.data);
      })
      .catch(() => {
        if (active) setUsage(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const metric = usage?.quota_applications_sent;
  if (!metric || metric.unlimited || metric.limit < 0 || metric.remaining <= 0) return null;

  const usedPct = metric.limit > 0 ? metric.used / metric.limit : 0;
  if (usedPct < 0.8) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-sm border border-warning/30 bg-warning/10 px-4 py-3 text-sm",
        className
      )}
    >
      <div className="flex items-start gap-2">
        <Gift className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
        <p className="text-foreground">
          <span className="font-medium">{metric.remaining} applications left</span>
          <span className="text-muted-foreground"> - refer friends to earn bonus sends.</span>
        </p>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={onShareClick}>
        Share link
      </Button>
    </div>
  );
}
