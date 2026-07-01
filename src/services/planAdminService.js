const { pool } = require("../db");
const planModel = require("../models/planModel");
const featureModel = require("../models/featureDefinitionModel");
const settingsModel = require("../models/settingsModel");
const { resolveIntervalPreset } = require("../constants/billingIntervals");

function validateEntitlementValue(feature, value) {
  switch (feature.type) {
    case "boolean":
      return typeof value === "boolean" ? { ok: true } : { ok: false, message: `${feature.key} must be boolean` };
    case "number":
      return typeof value === "number" ? { ok: true } : { ok: false, message: `${feature.key} must be a number` };
    case "enum": {
      const opts = feature.enumOptions || [];
      return opts.includes(value) ? { ok: true } : { ok: false, message: `${feature.key} must be one of ${opts.join(", ")}` };
    }
    case "string":
      return typeof value === "string" ? { ok: true } : { ok: false, message: `${feature.key} must be a string` };
    default:
      return { ok: true };
  }
}

async function isSinglePopularPlanEnabled() {
  const setting = await settingsModel.getSetting("single_popular_plan");
  if (setting === null || setting === undefined) return true;
  return setting !== false;
}

async function clearPopularExcept(planId, client = pool) {
  await client.query(
    `UPDATE plans SET popular = FALSE, updated_at = NOW() WHERE id != $1 AND popular = TRUE`,
    [planId]
  );
}

async function getPlanDetail(planId) {
  const plan = await planModel.getPlanById(planId);
  if (!plan) return null;
  const [pricePoints, features, entitlements, onboarding] = await Promise.all([
    planModel.listPricePoints(plan.id),
    planModel.listPlanFeatures(plan.id),
    planModel.listPlanEntitlements(plan.id),
    planModel.getOnboardingFlow(plan.id),
  ]);
  return { ...plan, pricePoints, features, entitlements, onboarding };
}

async function savePlanConfig(planId, body, userId) {
  const plan = await planModel.getPlanById(planId);
  if (!plan) {
    const err = new Error("Plan not found");
    err.status = 404;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const {
      displayName,
      description,
      sortOrder,
      isActive,
      isArchived,
      popular,
      planFeatures = [],
      advancedEntitlements = [],
      pricePoints = [],
    } = body;

    if (popular === true && await isSinglePopularPlanEnabled()) {
      await clearPopularExcept(planId, client);
    }

    await planModel.updatePlan(planId, {
      displayName,
      description: description ?? null,
      sortOrder,
      isActive,
      isArchived,
      popular,
    });

    for (const pp of pricePoints) {
      const preset = resolveIntervalPreset(pp.interval, pp.durationDays);
      const durationDays = pp.durationDays ?? preset.durationDays;
      if (!durationDays || durationDays <= 0) {
        const err = new Error("Each pricing option needs a valid billing period");
        err.status = 400;
        throw err;
      }
      const payload = {
        label: pp.label ?? preset.label,
        durationDays,
        amountPaise: pp.amountPaise,
        currency: pp.currency || "INR",
        interval: pp.interval || preset.interval,
        isActive: pp.isActive !== false,
        sortOrder: pp.sortOrder ?? 0,
      };
      if (pp.id) {
        await planModel.updatePricePoint(pp.id, payload, planId);
      } else {
        await planModel.createPricePoint({ planId, ...payload });
      }
    }

    const pickerFeatures = await featureModel.listFeatures({ includeInactive: false, pickerOnly: true });
    const pickerKeys = new Set(pickerFeatures.map((f) => f.key));

    for (const item of planFeatures) {
      if (!item.featureKey || !pickerKeys.has(item.featureKey)) continue;
      const feature = await featureModel.getFeatureByKey(item.featureKey);
      if (!feature || feature.type !== "boolean") continue;
      const included = item.included !== false;
      if (included) {
        await planModel.upsertPlanEntitlement(planId, feature.id, true, userId);
      } else {
        await planModel.deletePlanEntitlement(planId, feature.id);
      }
    }

    for (const item of advancedEntitlements) {
      const feature = await featureModel.getFeatureByKey(item.featureKey);
      if (!feature) {
        const err = new Error(`Unknown feature key: ${item.featureKey}`);
        err.status = 400;
        throw err;
      }
      const validation = validateEntitlementValue(feature, item.value);
      if (!validation.ok) {
        const err = new Error(validation.message);
        err.status = 400;
        throw err;
      }
      await planModel.upsertPlanEntitlement(planId, feature.id, item.value, userId);
    }

    const marketingRows = planFeatures
      .filter((f) => f.included !== false && f.featureKey && pickerKeys.has(f.featureKey))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((f, index) => ({
        featureKey: f.featureKey,
        label: f.label,
        included: true,
        sortOrder: f.sortOrder ?? index,
      }));

    await planModel.replacePlanFeatures(planId, marketingRows);

    await client.query("COMMIT");
    return getPlanDetail(planId);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function createPlanWithConfig(body, userId) {
  const {
    slug,
    displayName,
    description,
    sortOrder,
    isActive,
    popular,
    planFeatures,
    advancedEntitlements,
    pricePoints,
  } = body;
  const created = await planModel.createPlan({
    slug,
    displayName,
    description,
    sortOrder: sortOrder ?? 0,
    popular: false,
    isActive: isActive ?? false,
  });
  return savePlanConfig(created.id, {
    displayName,
    description,
    sortOrder,
    isActive,
    popular: popular ?? false,
    planFeatures,
    advancedEntitlements,
    pricePoints,
  }, userId);
}

async function duplicatePlan(sourcePlanId, { slug, displayName, sortOrder }, userId) {
  const source = await getPlanDetail(sourcePlanId);
  if (!source) {
    const err = new Error("Source plan not found");
    err.status = 404;
    throw err;
  }

  const pickerFeatures = await featureModel.listFeatures({ includeInactive: false, pickerOnly: true });
  const pickerKeys = new Set(pickerFeatures.map((f) => f.key));

  const planFeatures = (source.features || [])
    .filter((f) => f.featureKey && f.included !== false)
    .map((f, index) => ({
      featureKey: f.featureKey,
      label: f.label,
      included: true,
      sortOrder: f.sortOrder ?? index,
    }));

  for (const e of (source.entitlements || []).filter((x) => pickerKeys.has(x.key) && x.value === true)) {
    if (!planFeatures.some((pf) => pf.featureKey === e.key)) {
      planFeatures.push({
        featureKey: e.key,
        label: e.displayName,
        included: true,
        sortOrder: planFeatures.length,
      });
    }
  }

  const advancedEntitlements = (source.entitlements || [])
    .filter((e) => !pickerKeys.has(e.key))
    .map((e) => ({ featureKey: e.key, value: e.value }));

  return createPlanWithConfig({
    slug,
    displayName: displayName || `${source.displayName} (copy)`,
    description: source.description,
    sortOrder: sortOrder ?? source.sortOrder,
    isActive: false,
    popular: false,
    planFeatures,
    advancedEntitlements,
    pricePoints: (source.pricePoints || []).map((pp, index) => ({
      label: pp.label,
      durationDays: pp.durationDays,
      amountPaise: pp.amountPaise,
      currency: pp.currency,
      interval: pp.interval,
      isActive: pp.isActive,
      sortOrder: pp.sortOrder ?? index,
    })),
  }, userId);
}

module.exports = {
  getPlanDetail,
  savePlanConfig,
  createPlanWithConfig,
  duplicatePlan,
  isSinglePopularPlanEnabled,
  validateEntitlementValue,
};
