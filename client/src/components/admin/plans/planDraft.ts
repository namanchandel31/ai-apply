import type {
  AdminFeature,
  AdminPlan,
  AdminPlanConfigInput,
  AdminPlanFeatureInput,
  AdminPricePointInput,
} from "@/lib/api";

export type PlanEditorMode = "create-blank" | "create-duplicate" | "edit";

export type PlanEditorDraft = {
  planId: string | null;
  slug: string;
  displayName: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  isArchived: boolean;
  popular: boolean;
  pricePoints: AdminPricePointInput[];
  planFeatures: AdminPlanFeatureInput[];
  advancedEntitlements: Array<{ featureKey: string; value: unknown }>;
};

export const INTERVAL_OPTIONS = [
  { value: "week", label: "Weekly", durationDays: 7 },
  { value: "month", label: "Monthly", durationDays: 30 },
  { value: "quarter", label: "Quarterly", durationDays: 90 },
  { value: "year", label: "Yearly", durationDays: 365 },
  { value: "custom", label: "Custom", durationDays: 30 },
] as const;

export function emptyPricePoint(sortOrder = 0): AdminPricePointInput {
  return {
    durationDays: 30,
    amountPaise: 9900,
    currency: "INR",
    interval: "month",
    isActive: true,
    sortOrder,
    label: "Monthly",
  };
}

export function emptyDraft(sortOrder = 0): PlanEditorDraft {
  return {
    planId: null,
    slug: "",
    displayName: "",
    description: "",
    sortOrder,
    isActive: false,
    isArchived: false,
    popular: false,
    pricePoints: [emptyPricePoint()],
    planFeatures: [],
    advancedEntitlements: [],
  };
}

function inferInterval(durationDays: number, interval?: string | null) {
  if (interval && interval !== "custom") return interval;
  const match = INTERVAL_OPTIONS.find((o) => o.value !== "custom" && o.durationDays === durationDays);
  return match?.value ?? "custom";
}

export function draftFromPlan(plan: AdminPlan, pickerKeys: Set<string>): PlanEditorDraft {
  const planFeatures: AdminPlanFeatureInput[] = [];
  for (const f of plan.features ?? []) {
    if (!f.featureKey || !f.included) continue;
    planFeatures.push({
      featureKey: f.featureKey,
      label: f.label,
      included: true,
      sortOrder: f.sortOrder,
    });
  }
  for (const e of plan.entitlements ?? []) {
    if (!pickerKeys.has(e.key) || e.value !== true) continue;
    if (!planFeatures.some((pf) => pf.featureKey === e.key)) {
      planFeatures.push({
        featureKey: e.key,
        label: e.displayName,
        included: true,
        sortOrder: planFeatures.length,
      });
    }
  }
  planFeatures.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const advancedEntitlements = (plan.entitlements ?? [])
    .filter((e) => !pickerKeys.has(e.key))
    .map((e) => ({ featureKey: e.key, value: e.value }));

  return {
    planId: plan.id,
    slug: plan.slug,
    displayName: plan.displayName,
    description: plan.description ?? "",
    sortOrder: plan.sortOrder,
    isActive: plan.isActive,
    isArchived: plan.isArchived,
    popular: plan.popular,
    pricePoints: (plan.pricePoints ?? []).length
      ? (plan.pricePoints ?? []).map((pp, index) => ({
          id: pp.id,
          label: pp.label,
          durationDays: pp.durationDays,
          amountPaise: pp.amountPaise,
          currency: pp.currency,
          interval: inferInterval(pp.durationDays, pp.interval),
          isActive: pp.isActive,
          sortOrder: pp.sortOrder ?? index,
        }))
      : [emptyPricePoint()],
    planFeatures,
    advancedEntitlements,
  };
}

export function duplicateDraftFromPlan(plan: AdminPlan, pickerKeys: Set<string>, nextSortOrder: number): PlanEditorDraft {
  const base = draftFromPlan(plan, pickerKeys);
  return {
    ...base,
    planId: null,
    slug: "",
    displayName: `${plan.displayName} (copy)`,
    popular: false,
    isActive: false,
    sortOrder: nextSortOrder,
  };
}

export function serializeDraft(draft: PlanEditorDraft): string {
  return JSON.stringify(draft);
}

export function toConfigPayload(draft: PlanEditorDraft): AdminPlanConfigInput {
  return {
    displayName: draft.displayName.trim(),
    description: draft.description.trim() || null,
    sortOrder: draft.sortOrder,
    isActive: draft.isActive,
    isArchived: draft.isArchived,
    popular: draft.popular,
    planFeatures: draft.planFeatures.filter((f) => f.included !== false),
    advancedEntitlements: draft.advancedEntitlements,
    pricePoints: draft.pricePoints,
  };
}

export function isFeatureSelected(draft: PlanEditorDraft, featureKey: string) {
  return draft.planFeatures.some((f) => f.featureKey === featureKey && f.included !== false);
}

export function getFeatureLabel(draft: PlanEditorDraft, feature: AdminFeature) {
  return draft.planFeatures.find((f) => f.featureKey === feature.key)?.label ?? feature.displayName;
}

export function togglePlanFeature(draft: PlanEditorDraft, feature: AdminFeature, selected: boolean): PlanEditorDraft {
  const existing = draft.planFeatures.filter((f) => f.featureKey !== feature.key);
  if (!selected) {
    return { ...draft, planFeatures: existing };
  }
  return {
    ...draft,
    planFeatures: [
      ...existing,
      {
        featureKey: feature.key,
        label: feature.displayName,
        included: true,
        sortOrder: draft.planFeatures.length,
      },
    ],
  };
}

export function updateFeatureLabel(draft: PlanEditorDraft, featureKey: string, label: string): PlanEditorDraft {
  return {
    ...draft,
    planFeatures: draft.planFeatures.map((f) => (f.featureKey === featureKey ? { ...f, label } : f)),
  };
}

export function moveFeature(draft: PlanEditorDraft, featureKey: string, direction: -1 | 1): PlanEditorDraft {
  const items = [...draft.planFeatures].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const index = items.findIndex((f) => f.featureKey === featureKey);
  if (index < 0) return draft;
  const target = index + direction;
  if (target < 0 || target >= items.length) return draft;
  const next = [...items];
  const [row] = next.splice(index, 1);
  next.splice(target, 0, row);
  return {
    ...draft,
    planFeatures: next.map((f, i) => ({ ...f, sortOrder: i })),
  };
}

export function primaryPriceLabel(plan: AdminPlan) {
  const active = (plan.pricePoints ?? []).filter((p) => p.isActive);
  const pp = active[0] ?? plan.pricePoints?.[0];
  if (!pp) return "—";
  return `${(pp.amountPaise / 100).toLocaleString()} ${pp.currency}`;
}
