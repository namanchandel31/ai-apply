import { useCallback, useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Settings = Record<string, unknown>;

const TOGGLES: Array<{ key: string; label: string; help: string }> = [
  { key: "paywall_enabled", label: "Paywall enabled", help: "Require an active plan to use the product." },
  { key: "subscriptions_enabled", label: "Subscriptions enabled", help: "Master switch for the subscription system." },
  { key: "trials_enabled", label: "Trials enabled", help: "Allow campaign-driven free trials." },
  { key: "checkout_enabled", label: "Checkout enabled", help: "Allow new paid checkouts." },
  { key: "registration_enabled", label: "New user registration", help: "Allow new signups." },
];

const PAYWALL_TRIGGERS = [
  { value: "after_plan_selection", label: "After plan selection" },
  { value: "after_onboarding", label: "After onboarding" },
  { value: "before_first_apply", label: "Before first apply" },
];

export function BillingSettingsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.adminGetSettings();
      setSettings(res.data);
      setDraft(res.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setField = (key: string, value: unknown) =>
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await api.adminUpdateSettings(draft);
      setSettings(res.data);
      setDraft(res.data);
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !draft) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
      </div>
    );
  }

  const dirty = JSON.stringify(settings) !== JSON.stringify(draft);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Global toggles</CardTitle>
          <CardDescription>
            These take effect immediately, no redeploy. The <code>PRICING_ENABLED</code> environment
            variable is a kill-switch that overrides the paywall toggle.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {TOGGLES.map((t) => (
            <div key={t.key} className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor={t.key}>{t.label}</Label>
                <p className="text-xs text-muted-foreground">{t.help}</p>
              </div>
              <Switch
                id={t.key}
                checked={Boolean(draft[t.key])}
                onCheckedChange={(v) => setField(t.key, v)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paywall behavior</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Paywall trigger</Label>
            <Select
              value={String(draft.paywall_trigger ?? "after_plan_selection")}
              onValueChange={(v) => setField("paywall_trigger", v)}
            >
              <SelectTrigger className="max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYWALL_TRIGGERS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Where payment is collected. Plan selection always happens before onboarding.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="grace_days">Grace days</Label>
            <Input
              id="grace_days"
              type="number"
              min={0}
              className="max-w-[160px]"
              value={Number(draft.grace_days ?? 0)}
              onChange={(e) => setField("grace_days", Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Button type="button" onClick={() => void handleSave()} disabled={saving || !dirty} className="gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save settings
      </Button>
    </div>
  );
}
