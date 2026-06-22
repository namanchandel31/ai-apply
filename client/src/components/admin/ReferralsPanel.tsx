import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, type AdminReferralData } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ReferralsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<AdminReferralData | null>(null);
  const [form, setForm] = useState({
    referral_reward_applications: "10",
    referral_required_successful_applications: "1",
    referral_max_rewards_per_user: "5",
    referral_completion_window_hours: "24",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminReferrals();
      setData(res.data);
      const s = res.data.settings as Record<string, unknown>;
      setForm({
        referral_reward_applications: String(s.referral_reward_applications ?? 10),
        referral_required_successful_applications: String(
          s.referral_required_successful_applications ?? 1
        ),
        referral_max_rewards_per_user: String(s.referral_max_rewards_per_user ?? 5),
        referral_completion_window_hours: String(s.referral_completion_window_hours ?? 24),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load referrals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api.updateReferralSettings({
        referral_reward_applications: Number(form.referral_reward_applications),
        referral_required_successful_applications: Number(
          form.referral_required_successful_applications
        ),
        referral_max_rewards_per_user: Number(form.referral_max_rewards_per_user),
        referral_completion_window_hours: Number(form.referral_completion_window_hours),
      });
      toast.success("Referral settings saved");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading referral program…
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Referral analytics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <p className="text-muted-foreground">Total referrals</p>
            <p className="text-2xl font-semibold">{stats?.total ?? 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Completed</p>
            <p className="text-2xl font-semibold">{stats?.completed ?? 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Expired</p>
            <p className="text-2xl font-semibold">{stats?.expired ?? 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Bonus applications granted</p>
            <p className="text-2xl font-semibold">{stats?.bonusApplicationsGranted ?? 0}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Program settings</CardTitle>
          <CardDescription>Reward caps and activation rules.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 max-w-md">
          {(
            [
              ["referral_reward_applications", "Applications per referral"],
              ["referral_required_successful_applications", "Successful sends required"],
              ["referral_max_rewards_per_user", "Max rewarded referrals per user"],
              ["referral_completion_window_hours", "Completion window (hours)"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-2">
              <Label>{label}</Label>
              <Input
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
