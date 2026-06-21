import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { api, type AdminPlan, type AdminFeature } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

function PlanCard({ plan, features, onChanged }: { plan: AdminPlan; features: AdminFeature[]; onChanged: () => void }) {
  const [ent, setEnt] = useState<Record<string, unknown>>(() => {
    const map: Record<string, unknown> = {};
    for (const e of plan.entitlements ?? []) map[e.key] = e.value;
    return map;
  });
  const [savingEnt, setSavingEnt] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggleFlag = async (field: "isActive" | "isArchived" | "popular", value: boolean) => {
    setBusy(true);
    try {
      await api.adminUpdatePlan(plan.id, { [field]: value });
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const saveEntitlements = async () => {
    setSavingEnt(true);
    try {
      const entitlements = features.map((f) => ({ featureKey: f.key, value: ent[f.key] ?? f.defaultValue }));
      await api.adminUpdatePlanEntitlements(plan.id, entitlements);
      toast.success(`Entitlements saved for ${plan.displayName}`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingEnt(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">
              {plan.displayName} <span className="text-muted-foreground">({plan.slug})</span>
            </CardTitle>
            <CardDescription>{plan.description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {plan.isArchived ? <Badge variant="secondary">Archived</Badge> : null}
            {plan.popular ? <Badge>Popular</Badge> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={plan.isActive} disabled={busy} onCheckedChange={(v) => void toggleFlag("isActive", v)} />
            Active
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={plan.popular} disabled={busy} onCheckedChange={(v) => void toggleFlag("popular", v)} />
            Popular
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={plan.isArchived} disabled={busy} onCheckedChange={(v) => void toggleFlag("isArchived", v)} />
            Archived
          </label>
        </div>

        <div>
          <p className="mb-1 text-sm font-medium">Price points</p>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            {(plan.pricePoints ?? []).map((pp) => (
              <Badge key={pp.id} variant="secondary">
                {(pp.amountPaise / 100).toLocaleString()} {pp.currency} / {pp.durationDays}d
              </Badge>
            ))}
            {(plan.pricePoints ?? []).length === 0 ? <span>No price points</span> : null}
          </div>
        </div>

        <div>
          <p className="mb-1 text-sm font-medium">Onboarding steps</p>
          <p className="text-sm text-muted-foreground">{(plan.onboarding ?? []).join(" → ") || "—"}</p>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Entitlements</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {features.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.displayName}</Label>
                {f.type === "boolean" ? (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={ent[f.key] === true}
                      onCheckedChange={(v) => setEnt((p) => ({ ...p, [f.key]: v }))}
                    />
                    <span className="text-xs text-muted-foreground">{f.key}</span>
                  </div>
                ) : f.type === "number" ? (
                  <Input
                    type="number"
                    value={Number(ent[f.key] ?? 0)}
                    onChange={(e) => setEnt((p) => ({ ...p, [f.key]: Number(e.target.value) }))}
                  />
                ) : (
                  <Input
                    value={String(ent[f.key] ?? "")}
                    onChange={(e) => setEnt((p) => ({ ...p, [f.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>
          <Button type="button" className="mt-3 gap-2" size="sm" disabled={savingEnt} onClick={() => void saveEntitlements()}>
            {savingEnt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save entitlements
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function PlansPanel() {
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [features, setFeatures] = useState<AdminFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newPlan, setNewPlan] = useState({ slug: "", displayName: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, f] = await Promise.all([api.adminListPlans(), api.adminListFeatures()]);
      setPlans(p.data);
      setFeatures(f.data.filter((x) => x.isActive));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    if (!newPlan.slug || !newPlan.displayName) {
      toast.error("Slug and display name are required");
      return;
    }
    setCreating(true);
    try {
      await api.adminCreatePlan(newPlan);
      setNewPlan({ slug: "", displayName: "" });
      toast.success("Plan created");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading plans…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create plan</CardTitle>
          <CardDescription>Slug must be snake_case and is permanent.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="new-slug">Slug</Label>
            <Input
              id="new-slug"
              placeholder="growth"
              value={newPlan.slug}
              onChange={(e) => setNewPlan((p) => ({ ...p, slug: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-name">Display name</Label>
            <Input
              id="new-name"
              placeholder="Growth"
              value={newPlan.displayName}
              onChange={(e) => setNewPlan((p) => ({ ...p, displayName: e.target.value }))}
            />
          </div>
          <Button type="button" className="gap-2" disabled={creating} onClick={() => void handleCreate()}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create
          </Button>
        </CardContent>
      </Card>

      {plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} features={features} onChanged={() => void load()} />
      ))}
    </div>
  );
}
