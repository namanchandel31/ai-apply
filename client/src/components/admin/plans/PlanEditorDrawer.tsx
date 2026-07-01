import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  api,
  type AdminFeature,
  type AdminPlan,
  type AdminPricePointInput,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  emptyPricePoint,
  getFeatureLabel,
  INTERVAL_OPTIONS,
  isFeatureSelected,
  moveFeature,
  type PlanEditorDraft,
  type PlanEditorMode,
  serializeDraft,
  toConfigPayload,
  togglePlanFeature,
  updateFeatureLabel,
} from "./planDraft";

type Props = {
  open: boolean;
  mode: PlanEditorMode;
  draft: PlanEditorDraft;
  savedSnapshot: string;
  catalog: AdminFeature[];
  allPlans: AdminPlan[];
  onDraftChange: (draft: PlanEditorDraft) => void;
  onClose: () => void;
  onSaved: (draft: PlanEditorDraft) => void;
};

function PricingRow({
  row,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  row: AdminPricePointInput;
  index: number;
  onChange: (index: number, next: AdminPricePointInput) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}) {
  const preset = INTERVAL_OPTIONS.find((o) => o.value === (row.interval || "month")) ?? INTERVAL_OPTIONS[1];
  const isCustom = preset.value === "custom";

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Pricing option {index + 1}</p>
        {canRemove ? (
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => onRemove(index)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Billing interval</Label>
          <Select
            value={row.interval || "month"}
            onValueChange={(value) => {
              const opt = INTERVAL_OPTIONS.find((o) => o.value === value) ?? INTERVAL_OPTIONS[1];
              onChange(index, {
                ...row,
                interval: value,
                durationDays: opt.value === "custom" ? row.durationDays : opt.durationDays,
                label: opt.label,
              });
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {INTERVAL_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isCustom ? (
          <div className="space-y-1">
            <Label>Duration (days)</Label>
            <Input
              type="number"
              min={1}
              value={row.durationDays}
              onChange={(e) => onChange(index, { ...row, durationDays: Number(e.target.value) || 1 })}
            />
          </div>
        ) : null}
        <div className="space-y-1">
          <Label>Price</Label>
          <Input
            type="number"
            min={1}
            step="0.01"
            value={(row.amountPaise / 100).toString()}
            onChange={(e) => onChange(index, { ...row, amountPaise: Math.round(Number(e.target.value || 0) * 100) })}
          />
        </div>
        <div className="space-y-1">
          <Label>Currency</Label>
          <Select value={row.currency} onValueChange={(currency) => onChange(index, { ...row, currency })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="INR">INR</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={row.isActive !== false} onCheckedChange={(v) => onChange(index, { ...row, isActive: v })} />
        Active
      </label>
    </div>
  );
}

export function PlanEditorDrawer({
  open,
  mode,
  draft,
  savedSnapshot,
  catalog,
  allPlans,
  onDraftChange,
  onClose,
  onSaved,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [featureSearch, setFeatureSearch] = useState("");
  const [editingLabelKey, setEditingLabelKey] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);
  const [popularConfirmOpen, setPopularConfirmOpen] = useState(false);

  const isDirty = serializeDraft(draft) !== savedSnapshot;
  const isCreate = mode === "create-blank" || mode === "create-duplicate";
  const pickerFeatures = useMemo(
    () => catalog.filter((f) => f.showInPlanPicker && f.type === "boolean" && f.isActive),
    [catalog]
  );
  const advancedFeatures = useMemo(
    () => catalog.filter((f) => f.isActive && !f.showInPlanPicker),
    [catalog]
  );

  const filteredPicker = useMemo(() => {
    const q = featureSearch.trim().toLowerCase();
    if (!q) return pickerFeatures;
    return pickerFeatures.filter(
      (f) =>
        f.displayName.toLowerCase().includes(q) ||
        f.key.toLowerCase().includes(q) ||
        (f.category ?? "").toLowerCase().includes(q)
    );
  }, [featureSearch, pickerFeatures]);

  const selectedPreview = useMemo(
    () => [...draft.planFeatures].filter((f) => f.included !== false).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [draft.planFeatures]
  );

  useEffect(() => {
    if (!open) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [open, isDirty]);

  const requestClose = () => {
    if (isDirty) {
      setPendingClose(true);
      setConfirmOpen(true);
      return;
    }
    onClose();
  };

  const handleSave = async () => {
    if (!draft.displayName.trim()) {
      toast.error("Plan name is required");
      return;
    }
    if (isCreate && !draft.slug.trim()) {
      toast.error("Slug is required");
      return;
    }
    if (!draft.pricePoints.length) {
      toast.error("Add at least one pricing option");
      return;
    }
    setSaving(true);
    try {
      const payload = toConfigPayload(draft);
      if (isCreate) {
        await api.adminCreatePlanConfig({ slug: draft.slug.trim(), ...payload });
      } else if (draft.planId) {
        await api.adminSavePlanConfig(draft.planId, payload);
      }
      toast.success("Plan saved");
      onSaved(draft);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
      setConfirmOpen(false);
      setPendingClose(false);
    }
  };

  const handlePopularToggle = (next: boolean) => {
    if (!next) {
      onDraftChange({ ...draft, popular: false });
      return;
    }
    const otherPopular = allPlans.find((p) => p.popular && p.id !== draft.planId);
    if (otherPopular) {
      setPopularConfirmOpen(true);
      return;
    }
    onDraftChange({ ...draft, popular: true });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => { if (!next) requestClose(); }}>
        <SheetContent
          side="right"
          className="flex w-full max-w-full flex-col gap-0 p-0 sm:w-[40vw] sm:max-w-[40vw] lg:max-w-[40vw]"
        >
          <SheetHeader className="shrink-0 border-b border-border px-6 py-4">
            <div className="flex items-center justify-between gap-3 pr-8">
              <SheetTitle>{isCreate ? "Create plan" : "Edit plan"}</SheetTitle>
              {isDirty ? <span className="text-xs text-amber-600">Unsaved changes</span> : null}
            </div>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Plan information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1 sm:col-span-2">
                      <Label>Plan name</Label>
                      <Input value={draft.displayName} onChange={(e) => onDraftChange({ ...draft, displayName: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Slug</Label>
                      {isCreate ? (
                        <Input
                          placeholder="growth"
                          value={draft.slug}
                          onChange={(e) => onDraftChange({ ...draft, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input value={draft.slug} readOnly className="bg-muted/40" />
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      {!isCreate ? (
                        <p className="text-xs text-muted-foreground">
                          Slugs are permanent because they are referenced by subscriptions, orders, and internal integrations.
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      <Label>Display order</Label>
                      <Input
                        type="number"
                        value={draft.sortOrder}
                        onChange={(e) => onDraftChange({ ...draft, sortOrder: Number(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-muted-foreground">Lower numbers appear first on the pricing page.</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-6">
                    <label className="flex items-center gap-2 text-sm">
                      <Switch checked={draft.isActive} onCheckedChange={(v) => onDraftChange({ ...draft, isActive: v })} />
                      Active
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Switch checked={draft.popular} onCheckedChange={handlePopularToggle} />
                      <Star className={cn("h-4 w-4", draft.popular ? "fill-amber-400 text-amber-500" : "text-muted-foreground")} />
                      Mark as popular
                    </label>
                  </div>

                  <details className="rounded-lg border border-border/70 p-3">
                    <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                      Marketing description (optional)
                    </summary>
                    <Textarea
                      className="mt-3 min-h-[88px]"
                      placeholder="Short marketing copy shown on the subscription page"
                      value={draft.description}
                      onChange={(e) => onDraftChange({ ...draft, description: e.target.value })}
                    />
                  </details>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">Pricing</CardTitle>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() =>
                        onDraftChange({
                          ...draft,
                          pricePoints: [...draft.pricePoints, emptyPricePoint(draft.pricePoints.length)],
                        })
                      }
                    >
                      <Plus className="h-4 w-4" /> Add option
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Price changes apply to new checkouts immediately. OneTap uses Razorpay Orders.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {draft.pricePoints.map((row, index) => (
                    <PricingRow
                      key={row.id ?? `new-${index}`}
                      row={row}
                      index={index}
                      canRemove={draft.pricePoints.length > 1}
                      onChange={(i, next) => {
                        const pricePoints = [...draft.pricePoints];
                        pricePoints[i] = { ...next, sortOrder: i };
                        onDraftChange({ ...draft, pricePoints });
                      }}
                      onRemove={(i) => onDraftChange({ ...draft, pricePoints: draft.pricePoints.filter((_, idx) => idx !== i) })}
                    />
                  ))}
                </CardContent>
              </Card>
            </div>

            <aside className="w-full shrink-0 border-t border-border bg-muted/20 lg:w-[38%] lg:min-w-[300px] lg:max-w-[520px] lg:border-l lg:border-t-0">
              <div className="flex h-full flex-col">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-sm font-medium">Included features</p>
                  <Input
                    className="mt-2"
                    placeholder="Search features…"
                    value={featureSearch}
                    onChange={(e) => setFeatureSearch(e.target.value)}
                  />
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-2">
                  {filteredPicker.map((feature) => {
                    const selected = isFeatureSelected(draft, feature.key);
                    const label = getFeatureLabel(draft, feature);
                    return (
                      <div key={feature.key} className="rounded-md border border-border/70 bg-card p-2.5">
                        <div className="flex items-start gap-2">
                          <Checkbox
                            checked={selected}
                            onCheckedChange={(checked) =>
                              onDraftChange(togglePlanFeature(draft, feature, checked === true))
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-tight">{feature.displayName}</p>
                            {selected ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Shows as: <span className="font-medium text-foreground">{label}</span>
                              </p>
                            ) : null}
                          </div>
                          {selected ? (
                            <div className="flex items-center gap-0.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => onDraftChange(moveFeature(draft, feature.key, -1))}
                              >
                                <ChevronUp className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => onDraftChange(moveFeature(draft, feature.key, 1))}
                              >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => {
                                  setEditingLabelKey(feature.key);
                                  setLabelDraft(label);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : null}
                        </div>
                        {editingLabelKey === feature.key ? (
                          <div className="mt-2 flex items-center gap-2">
                            <Input
                              value={labelDraft}
                              onChange={(e) => setLabelDraft(e.target.value)}
                              placeholder={`Defaults to: ${feature.displayName}`}
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-9 w-9 shrink-0"
                              onClick={() => {
                                onDraftChange(updateFeatureLabel(draft, feature.key, labelDraft.trim() || feature.displayName));
                                setEditingLabelKey(null);
                              }}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => setEditingLabelKey(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {filteredPicker.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No features match your search.</p>
                  ) : null}
                </div>

                <div className="border-t border-border px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">As shown on subscription page</p>
                  <ul className="mt-2 space-y-1.5">
                    {selectedPreview.length ? selectedPreview.map((f) => (
                      <li key={f.featureKey} className="flex items-center gap-2 text-sm">
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        {f.label}
                      </li>
                    )) : (
                      <li className="text-sm text-muted-foreground">No features selected</li>
                    )}
                  </ul>
                </div>

                {advancedFeatures.length ? (
                  <details className="border-t border-border px-4 py-3">
                    <summary className="cursor-pointer text-sm font-medium">Advanced limits</summary>
                    <div className="mt-3 space-y-3">
                      {advancedFeatures.map((feature) => {
                        const current = draft.advancedEntitlements.find((e) => e.featureKey === feature.key)?.value;
                        return (
                          <div key={feature.key} className="space-y-1">
                            <Label className="text-xs">{feature.displayName}</Label>
                            {feature.type === "number" ? (
                              <Input
                                type="number"
                                value={Number(current ?? feature.defaultValue ?? 0)}
                                onChange={(e) => {
                                  const value = Number(e.target.value);
                                  const rest = draft.advancedEntitlements.filter((x) => x.featureKey !== feature.key);
                                  onDraftChange({ ...draft, advancedEntitlements: [...rest, { featureKey: feature.key, value }] });
                                }}
                              />
                            ) : feature.type === "enum" ? (
                              <Select
                                value={String(current ?? feature.defaultValue ?? "")}
                                onValueChange={(value) => {
                                  const rest = draft.advancedEntitlements.filter((x) => x.featureKey !== feature.key);
                                  onDraftChange({ ...draft, advancedEntitlements: [...rest, { featureKey: feature.key, value }] });
                                }}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {(feature.enumOptions ?? []).map((opt) => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                value={String(current ?? "")}
                                onChange={(e) => {
                                  const rest = draft.advancedEntitlements.filter((x) => x.featureKey !== feature.key);
                                  onDraftChange({ ...draft, advancedEntitlements: [...rest, { featureKey: feature.key, value: e.target.value }] });
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                ) : null}
              </div>
            </aside>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-6 py-4">
            <Button type="button" variant="outline" onClick={requestClose} disabled={saving}>Cancel</Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save plan
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>You have unsaved changes</DialogTitle>
            <DialogDescription>Discard changes?</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => { setConfirmOpen(false); setPendingClose(false); }}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setConfirmOpen(false);
                if (pendingClose) onClose();
                setPendingClose(false);
              }}
            >
              Discard
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={popularConfirmOpen} onOpenChange={setPopularConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change popular plan?</DialogTitle>
            <DialogDescription>
              This will remove the popular badge from the current popular plan when you save.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setPopularConfirmOpen(false)}>Cancel</Button>
            <Button
              type="button"
              onClick={() => {
                onDraftChange({ ...draft, popular: true });
                setPopularConfirmOpen(false);
              }}
            >
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
