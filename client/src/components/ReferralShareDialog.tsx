import { useEffect, useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, type ReferralSummary } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ReferralShareDialog({ open, onOpenChange }: Props) {
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    api
      .getReferralSummary()
      .then((res) => {
        if (active) setSummary(res.data);
      })
      .catch(() => {
        if (active) toast.error("Could not load your referral link");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  const shareUrl =
    summary?.referralCode && typeof window !== "undefined"
      ? `${window.location.origin}/signup?ref=${summary.referralCode}`
      : "";

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Referral link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Refer friends for bonus sends</DialogTitle>
          <DialogDescription>
            Share your link. When a friend signs up and sends their first application, you earn{" "}
            {summary?.rewardApplications ?? 10} extra trial applications.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : summary?.programEnabled === false ? (
          <p className="text-sm text-muted-foreground">The referral program is not active right now.</p>
        ) : (
          <div className="space-y-3 pt-1">
            <div className="flex gap-2">
              <Input readOnly value={shareUrl} className="font-mono text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={() => void handleCopy()} disabled={!shareUrl}>
                <Copy className="h-4 w-4" />
                <span className="sr-only">Copy link</span>
              </Button>
            </div>
            {summary && (
              <p className="text-xs text-muted-foreground">
                Rewards earned: {summary.rewardsGranted} / {summary.maxRewards}
                {summary.bonusApplicationsTotal > 0
                  ? ` · +${summary.bonusApplicationsTotal} bonus applications total`
                  : ""}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
