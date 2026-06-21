import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { api, type AdminCampaign } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EMPTY = {
  name: "",
  code: "",
  type: "trial" as AdminCampaign["type"],
  trialDays: 7,
  userLimit: 100,
  discountType: "percent" as "percent" | "fixed",
  discountAmount: 0,
};

export function CampaignsPanel() {
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.adminListCampaigns();
      setCampaigns(res.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    if (!form.name) {
      toast.error("Name is required");
      return;
    }
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        code: form.code || undefined,
        type: form.type,
        userLimit: form.userLimit || null,
        enabled: false,
      };
      if (form.type === "trial") body.trialDays = form.trialDays;
      if (form.type === "discount") {
        body.discountType = form.discountType;
        body.discountAmount = form.discountAmount;
      }
      await api.adminCreateCampaign(body);
      setForm(EMPTY);
      toast.success("Campaign created (disabled). Enable it when ready.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const toggleEnabled = async (c: AdminCampaign, enabled: boolean) => {
    try {
      await api.adminUpdateCampaign(c.id, { enabled });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading campaigns…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create campaign</CardTitle>
          <CardDescription>
            Campaigns layer trials/discounts on top of plans. Plans never define trials directly.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="First 100 users" />
          </div>
          <div className="space-y-1">
            <Label>Code (for user-facing claim)</Label>
            <Input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} placeholder="FIRST100" />
          </div>
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v as AdminCampaign["type"] }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="discount">Discount</SelectItem>
                <SelectItem value="early_access">Early access</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>User limit (blank = unlimited)</Label>
            <Input
              type="number"
              value={form.userLimit}
              onChange={(e) => setForm((p) => ({ ...p, userLimit: Number(e.target.value) }))}
            />
          </div>
          {form.type === "trial" ? (
            <div className="space-y-1">
              <Label>Trial days</Label>
              <Input
                type="number"
                value={form.trialDays}
                onChange={(e) => setForm((p) => ({ ...p, trialDays: Number(e.target.value) }))}
              />
            </div>
          ) : null}
          {form.type === "discount" ? (
            <>
              <div className="space-y-1">
                <Label>Discount type</Label>
                <Select
                  value={form.discountType}
                  onValueChange={(v) => setForm((p) => ({ ...p, discountType: v as "percent" | "fixed" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent</SelectItem>
                    <SelectItem value="fixed">Fixed (paise)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Discount amount</Label>
                <Input
                  type="number"
                  value={form.discountAmount}
                  onChange={(e) => setForm((p) => ({ ...p, discountAmount: Number(e.target.value) }))}
                />
              </div>
            </>
          ) : null}
          <div className="sm:col-span-2">
            <Button type="button" className="gap-2" disabled={creating} onClick={() => void handleCreate()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create campaign
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {campaigns.map((c) => (
          <Card key={c.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="font-medium">
                  {c.name} <Badge variant="secondary">{c.type}</Badge>{" "}
                  {c.code ? <Badge variant="outline">{c.code}</Badge> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {c.type === "trial" ? `${c.trialDays} days` : null}
                  {c.type === "discount"
                    ? `${c.discountAmount}${c.discountType === "percent" ? "%" : " paise"} off`
                    : null}
                  {" · "}
                  Claimed {c.claimedCount}
                  {c.userLimit != null ? ` / ${c.userLimit}` : ""}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={c.enabled} onCheckedChange={(v) => void toggleEnabled(c, v)} />
                {c.enabled ? "Enabled" : "Disabled"}
              </label>
            </CardContent>
          </Card>
        ))}
        {campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No campaigns yet.</p>
        ) : null}
      </div>
    </div>
  );
}
