import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Crown, Loader2, Megaphone, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { SetupPageShell } from "@/components/layout/SetupPageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, type ReferralRecord, type ReferralSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

function buildReferralShareUrl(referralCode: string) {
  return `${window.location.origin}/signup?ref=${referralCode}`;
}

function formatReferralDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusLabel(status: ReferralRecord["status"]) {
  switch (status) {
    case "completed":
      return "Rewarded";
    case "pending":
      return "In progress";
    case "expired":
      return "Expired";
    case "rejected":
      return "Not eligible";
    default:
      return status;
  }
}

function statusClass(status: ReferralRecord["status"]) {
  switch (status) {
    case "completed":
      return "bg-emerald-50 text-emerald-700";
    case "pending":
      return "bg-blue-50 text-blue-700";
    case "expired":
    case "rejected":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function ReferralsPage() {
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReferrals = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, listRes] = await Promise.all([
        api.getReferralSummary(),
        api.getReferrals(),
      ]);
      setSummary(summaryRes.data);
      setReferrals(listRes.data.referrals);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load referrals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReferrals();
  }, [loadReferrals]);

  const shareUrl = summary?.referralCode ? buildReferralShareUrl(summary.referralCode) : "";
  const completedCount = useMemo(
    () => referrals.filter((referral) => referral.status === "completed").length,
    [referrals]
  );

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Referral link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const handleCopyCode = async () => {
    if (!summary?.referralCode) return;
    try {
      await navigator.clipboard.writeText(summary.referralCode);
      toast.success("Referral code copied");
    } catch {
      toast.error("Could not copy code");
    }
  };

  const rewardApplications = summary?.rewardApplications ?? 10;
  const requiredSends = summary?.requiredSends ?? 1;
  const completionWindowHours = summary?.completionWindowHours ?? 24;

  return (
    <SetupPageShell
      title="Refer and earn rewards"
      description={`Share your link. When a friend signs up and sends ${requiredSends} application${requiredSends === 1 ? "" : "s"}, you earn ${rewardApplications} bonus applications.`}
      contentClassName="max-w-3xl"
    >
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : summary?.programEnabled === false ? (
        <Card className="border border-border shadow-none">
          <CardContent className="p-6 text-sm text-muted-foreground">
            The referral program is not active right now.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="refer" className="gap-6">
          <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-b border-border bg-transparent p-0">
            <TabsTrigger
              value="refer"
              className="rounded-none border-b-2 border-transparent px-0 pb-3 pt-0 text-base data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Refer
            </TabsTrigger>
            <TabsTrigger
              value="past"
              className="rounded-none border-b-2 border-transparent px-0 pb-3 pt-0 text-base data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Past referrals ({completedCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="refer" className="mt-0">
            <Card className="border border-border bg-muted/20 shadow-none">
              <CardContent className="space-y-6 p-6">
                <div>
                  <h2 className="text-base font-medium text-foreground">How it works</h2>
                  <ul className="mt-4 space-y-3">
                    <li className="flex items-start gap-3 text-sm text-foreground">
                      <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      Share your invite link or referral code
                    </li>
                    <li className="flex items-start gap-3 text-sm text-foreground">
                      <Crown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      They sign up with your link and start applying
                    </li>
                    <li className="flex items-start gap-3 text-sm text-foreground">
                      <PartyPopper className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      You earn {rewardApplications} bonus applications when they send{" "}
                      {requiredSends} within {completionWindowHours} hours
                    </li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Your invite link</p>
                  <div className="flex gap-2">
                    <Input readOnly value={shareUrl} className="bg-white font-mono text-xs" />
                    <Button type="button" variant="outline" onClick={() => void handleCopyLink()} disabled={!shareUrl}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Your referral code</p>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={summary?.referralCode ?? ""}
                      className="bg-white font-mono text-sm tracking-widest"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleCopyCode()}
                      disabled={!summary?.referralCode}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </Button>
                  </div>
                </div>

                {summary ? (
                  <p className="text-xs text-muted-foreground">
                    Rewards earned: {summary.rewardsGranted} / {summary.maxRewards}
                    {summary.bonusApplicationsTotal > 0
                      ? ` · +${summary.bonusApplicationsTotal} bonus applications total`
                      : ""}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="past" className="mt-0">
            <Card className="border border-border shadow-none">
              <CardContent className="p-0">
                {referrals.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">
                    No referrals yet. Share your link to start earning bonus applications.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {referrals.map((referral) => (
                      <li key={referral.id} className="flex items-center justify-between gap-4 px-6 py-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {referral.displayName}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Joined {formatReferralDate(referral.createdAt)}
                            {referral.status === "completed" && referral.completedAt
                              ? ` · Rewarded ${formatReferralDate(referral.completedAt)}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-xs font-medium",
                              statusClass(referral.status)
                            )}
                          >
                            {statusLabel(referral.status)}
                          </span>
                          {referral.applicationsGranted ? (
                            <span className="text-xs text-muted-foreground">
                              +{referral.applicationsGranted} applications
                            </span>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </SetupPageShell>
  );
}
