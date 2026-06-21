import { useEffect, useState } from "react";
import { api, type UsageSummary } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/**
 * Progressive free-trial usage indicators. Limits + used counts come entirely from
 * the entitlement resolution (getUsageSummary) — never hardcoded here — so admins
 * can retune the trial without a client deploy. Hidden when the user has no metered
 * trial limits (e.g. paid / unlimited plans).
 */
const TRIAL_LABELS: Record<string, string> = {
  quota_resumes_parsed: "Resume Parses",
  quota_jds_parsed: "Job Descriptions",
  quota_emails_generated: "Emails Generated",
  quota_applications_sent: "Applications Sent",
};

interface Props {
  className?: string;
}

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

  if (!usage) return null;

  const rows = Object.keys(TRIAL_LABELS)
    .map((key) => ({ key, label: TRIAL_LABELS[key], metric: usage[key] }))
    .filter((r) => r.metric && !r.metric.unlimited && r.metric.limit >= 0);

  if (rows.length === 0) return null;

  return (
    <Card className={cn("rounded-sm", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Free trial usage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map(({ key, label, metric }) => {
          const used = Math.min(metric.used, metric.limit);
          const pct = metric.limit > 0 ? Math.min(100, Math.round((used / metric.limit) * 100)) : 0;
          const exhausted = metric.remaining <= 0;
          const nearLimit = !exhausted && metric.remaining <= Math.max(1, Math.ceil(metric.limit * 0.2));
          return (
            <div key={key} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{label}</span>
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
              {exhausted && (
                <p className="text-xs text-destructive">
                  Free trial limit reached — upgrade to keep going.
                </p>
              )}
              {nearLimit && (
                <p className="text-xs text-warning">
                  {metric.remaining} left on your free trial.
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
