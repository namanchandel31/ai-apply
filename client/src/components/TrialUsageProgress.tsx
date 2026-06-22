import { useEffect, useState } from "react";
import { api, type UsageSummary } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

/**
 * Free trial progress — user-facing quota is Applications Sent only.
 */
export function TrialUsageProgress({ className }: Props) {
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
  if (!metric || metric.unlimited || metric.limit < 0) return null;

  const used = Math.min(metric.used, metric.limit);
  const pct = metric.limit > 0 ? Math.min(100, Math.round((used / metric.limit) * 100)) : 0;
  const exhausted = metric.remaining <= 0;
  const nearLimit = !exhausted && metric.remaining <= Math.max(1, Math.ceil(metric.limit * 0.2));

  return (
    <Card className={cn("rounded-sm", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Free trial</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Applications Sent</span>
            <span
              className={cn(
                "tabular-nums text-muted-foreground",
                exhausted && "text-destructive",
                nearLimit && "text-warning"
              )}
            >
              {metric.used} / {metric.limit}
            </span>
          </div>
          <Progress value={pct} />
          <p className="text-sm text-muted-foreground">
            Applications Remaining:{" "}
            <span className={cn("font-medium tabular-nums", exhausted && "text-destructive")}>
              {metric.remaining}
            </span>
          </p>
          {typeof metric.bonusLimit === "number" && metric.bonusLimit > 0 && (
            <p className="text-xs text-muted-foreground">
              Includes +{metric.bonusLimit} referral bonus on base {metric.baseLimit}
            </p>
          )}
          {exhausted && (
            <p className="text-xs text-destructive">
              Trial limit reached - upgrade, use BYOK, or refer friends for more sends.
            </p>
          )}
          {nearLimit && (
            <p className="text-xs text-warning">{metric.remaining} applications left on your trial.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
