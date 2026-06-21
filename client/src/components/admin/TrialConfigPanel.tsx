import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, Gauge, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { api, type AdminFeature, type AdminPlan } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TrialMode = "usage" | "time";
type Settings = Record<string, unknown>;

const QUOTA_KEYS = [
  "quota_resumes_parsed",
  "quota_jds_parsed",
  "quota_emails_generated",
  "quota_applications_sent",
] as const;

const QUOTA_LABELS: Record<(typeof QUOTA_KEYS)[number], string> = {
  quota_resumes_parsed: "Resume parses",
  quota_jds_parsed: "Job description parses",
  quota_emails_generated: "AI emails generated",
  quota_applications_sent: "Applications sent",
};

const QUOTA_HELP: Record<(typeof QUOTA_KEYS)[number], string> = {
  quota_resumes_parsed: "Lifetime parse attempts per new user (deleting a resume does not refund a parse).",
  quota_jds_parsed: "Lifetime job-description parses before upgrade.",
  quota_emails_generated: "Lifetime AI email generations before upgrade.",
  quota_applications_sent: "Lifetime application sends before upgrade.",
};

function normalizeTrialMode(value: unknown): TrialMode {
  return value === "time" ? "time" : "usage";
}

export function TrialConfigPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [features, setFeatures] = useState<AdminFeature[]>([]);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [trialMode, setTrialMode] = useState<TrialMode>("usage");
  const [trialDays, setTrialDays] = useState(7);
  const [trialPlanSlug, setTrialPlanSlug] = useState("byok");
  const [quotas, setQuotas] = useState<Record<string, number>>({});

  const quotaFeatures = useMemo(
    () => features.filter((f) => QUOTA_KEYS.includes(f.key as (typeof QUOTA_KEYS)[number])),
    [features]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, featuresRes, plansRes] = await Promise.all([
        api.adminGetSettings(),
        api.adminListFeatures(),
        api.adminListPlans(),
      ]);
      const s = settingsRes.data;
      setSettings(s);
      setTrialMode(normalizeTrialMode(s.trial_mode));
      setTrialDays(Math.max(1, Number(s.default_trial_days ?? 7)));
      setTrialPlanSlug(String(s.default_trial_plan_slug ?? "byok"));

      const activeFeatures = featuresRes.data.filter((f) => f.isActive);
      setFeatures(activeFeatures);
      const quotaMap: Record<string, number> = {};
      for (const key of QUOTA_KEYS) {
        const feature = activeFeatures.find((f) => f.key === key);
        quotaMap[key] = Number(feature?.defaultValue ?? 0);
      }
      setQuotas(quotaMap);
      setPlans(plansRes.data.filter((p) => p.isActive && !p.isArchived));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load trial settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.adminUpdateSettings({
        trial_mode: trialMode,
        default_trial_days: trialDays,
        default_trial_plan_slug: trialPlanSlug,
      });

      if (trialMode === "usage") {
        await Promise.all(
          quotaFeatures.map((feature) => {
            const value = quotas[feature.key];
            if (value === undefined || Number.isNaN(value)) return Promise.resolve();
            return api.adminUpdateFeature(feature.id, { defaultValue: value });
          })
        );
      }

      toast.success("Trial configuration saved");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save trial settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading trial configuration…
      </div>
    );
  }

  const missingQuotaFeatures = QUOTA_KEYS.filter((k) => !quotaFeatures.some((f) => f.key === k));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trial strategy</CardTitle>
          <CardDescription>
            Choose how new users experience the product before they pay. Only one mode is active at a
            time. Requires <strong>Paywall enabled</strong> and <strong>Trials enabled</strong> in
            Settings for enforcement.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setTrialMode("usage")}
            className={cn(
              "rounded-lg border p-4 text-left transition-colors",
              trialMode === "usage"
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border hover:border-muted-foreground/40"
            )}
          >
            <div className="mb-2 flex items-center gap-2 font-medium">
              <Gauge className="h-4 w-4" />
              Usage trial
            </div>
            <p className="text-sm text-muted-foreground">
              Meter specific actions (resume parses, sends, etc.). Users hit limits one action at a
              time — ideal for letting prospects feel the product without giving full access.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setTrialMode("time")}
            className={cn(
              "rounded-lg border p-4 text-left transition-colors",
              trialMode === "time"
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border hover:border-muted-foreground/40"
            )}
          >
            <div className="mb-2 flex items-center gap-2 font-medium">
              <Clock className="h-4 w-4" />
              Time trial
            </div>
            <p className="text-sm text-muted-foreground">
              Grant new users a fixed number of days on a plan with full access. When time runs out,
              they must upgrade. Campaign codes can still layer on top.
            </p>
          </button>
        </CardContent>
      </Card>

      {trialMode === "usage" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usage limits (free tier defaults)</CardTitle>
            <CardDescription>
              These apply to users without an active subscription while usage trial mode is on.
              Changes take effect immediately for new actions; existing usage counters are not reset.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {missingQuotaFeatures.length > 0 ? (
              <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
                Quota features missing from catalog ({missingQuotaFeatures.join(", ")}). Run database
                migration 045 to seed them.
              </p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              {QUOTA_KEYS.map((key) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={key}>{QUOTA_LABELS[key]}</Label>
                  <Input
                    id={key}
                    type="number"
                    min={0}
                    value={quotas[key] ?? 0}
                    onChange={(e) =>
                      setQuotas((prev) => ({ ...prev, [key]: Math.max(0, Number(e.target.value)) }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">{QUOTA_HELP[key]}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Time trial access</CardTitle>
            <CardDescription>
              Brand-new users automatically receive this trial on first use. Users who already had a
              subscription or trial are not re-granted.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="trial-days">Trial length (days)</Label>
              <Input
                id="trial-days"
                type="number"
                min={1}
                max={365}
                value={trialDays}
                onChange={(e) => setTrialDays(Math.max(1, Number(e.target.value)))}
              />
              <p className="text-xs text-muted-foreground">Between 1 and 365 days.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Plan to grant</Label>
              <Select value={trialPlanSlug} onValueChange={setTrialPlanSlug}>
                <SelectTrigger>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.slug}>
                      {p.displayName} ({p.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Entitlements from this plan apply during the trial (paid plans are unlimited on usage
                quotas).
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Button type="button" className="gap-2" disabled={saving} onClick={() => void handleSave()}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save trial configuration
      </Button>
    </div>
  );
}
