import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Loader2, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type AdminFeature, type AdminPlan } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlanEditorDrawer } from "./PlanEditorDrawer";
import { pricingQueryOptions } from "@/queries/pricingQueries";
import {
  duplicateDraftFromPlan,
  draftFromPlan,
  emptyDraft,
  primaryPriceLabel,
  serializeDraft,
  type PlanEditorDraft,
  type PlanEditorMode,
} from "./planDraft";

export function PlansPanel() {
  const queryClient = useQueryClient();
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [catalog, setCatalog] = useState<AdminFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mode, setMode] = useState<PlanEditorMode>("edit");
  const [draft, setDraft] = useState<PlanEditorDraft>(emptyDraft());
  const [savedSnapshot, setSavedSnapshot] = useState(serializeDraft(emptyDraft()));
  const [duplicatePickId, setDuplicatePickId] = useState<string>("");

  const pickerKeys = useMemo(
    () => new Set(catalog.filter((f) => f.showInPlanPicker).map((f) => f.key)),
    [catalog]
  );

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName)),
    [plans]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, featuresRes] = await Promise.all([api.adminListPlans(), api.adminListFeatures()]);
      setPlans(plansRes.data);
      setCatalog(featuresRes.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openDraft = (nextDraft: PlanEditorDraft, nextMode: PlanEditorMode) => {
    setDraft(nextDraft);
    setSavedSnapshot(serializeDraft(nextDraft));
    setMode(nextMode);
    setDrawerOpen(true);
  };

  const openBlank = () => {
    const nextSort = sortedPlans.length ? Math.max(...sortedPlans.map((p) => p.sortOrder)) + 1 : 0;
    openDraft(emptyDraft(nextSort), "create-blank");
  };

  const openDuplicate = (source: AdminPlan) => {
    const nextSort = sortedPlans.length ? Math.max(...sortedPlans.map((p) => p.sortOrder)) + 1 : 0;
    openDraft(duplicateDraftFromPlan(source, pickerKeys, nextSort), "create-duplicate");
  };

  const openEdit = (plan: AdminPlan) => {
    openDraft(draftFromPlan(plan, pickerKeys), "edit");
  };

  const trySwitchPlan = (plan: AdminPlan) => {
    if (drawerOpen) {
      const dirty = serializeDraft(draft) !== savedSnapshot;
      if (dirty) {
        toast.message("Save or discard changes before switching plans");
        return;
      }
    }
    openEdit(plan);
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
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Subscription plans</CardTitle>
            <CardDescription>Manage pricing, features, and display order for plans shown on the pricing and subscription pages.</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" className="gap-2">
                <Plus className="h-4 w-4" /> New plan
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Create plan</DropdownMenuLabel>
              <DropdownMenuItem onClick={openBlank}>Blank plan</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">Duplicate existing</DropdownMenuLabel>
              <div className="px-2 pb-2">
                <Select value={duplicatePickId} onValueChange={setDuplicatePickId}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Select plan" /></SelectTrigger>
                  <SelectContent>
                    {sortedPlans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>{plan.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DropdownMenuItem
                disabled={!duplicatePickId}
                onClick={() => {
                  const source = sortedPlans.find((p) => p.id === duplicatePickId);
                  if (source) openDuplicate(source);
                }}
              >
                <Copy className="mr-2 h-4 w-4" /> Duplicate selected
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Order</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Features</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPlans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="tabular-nums">{plan.sortOrder}</TableCell>
                  <TableCell className="font-medium">
                    {plan.displayName}
                    {plan.popular ? <Badge className="ml-2" variant="secondary">Popular</Badge> : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{plan.slug}</TableCell>
                  <TableCell>{primaryPriceLabel(plan)}</TableCell>
                  <TableCell>{(plan.features ?? []).filter((f) => f.included).length}</TableCell>
                  <TableCell>
                    {plan.isArchived ? <Badge variant="outline">Archived</Badge> : plan.isActive ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button type="button" variant="outline" size="sm" onClick={() => trySwitchPlan(plan)}>
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {sortedPlans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    No plans yet. Create your first plan to get started.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PlanEditorDrawer
        open={drawerOpen}
        mode={mode}
        draft={draft}
        savedSnapshot={savedSnapshot}
        catalog={catalog}
        allPlans={plans}
        onDraftChange={setDraft}
        onClose={() => setDrawerOpen(false)}
        onSaved={(savedDraft) => {
          setSavedSnapshot(serializeDraft(savedDraft));
          setDraft(savedDraft);
          void queryClient.invalidateQueries({ queryKey: pricingQueryOptions.queryKey });
          void load();
        }}
      />
    </div>
  );
}
