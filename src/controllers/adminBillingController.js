const { ok, error, ERROR_CODES } = require("../utils/response");
const { logError } = require("../utils/logger");
const { sendError } = require("../utils/httpErrorResponse");
const settingsService = require("../services/settingsService");
const auditService = require("../services/auditService");
const planComparisonService = require("../services/planComparisonService");
const subscriptionService = require("../services/subscriptionService");
const settingsModel = require("../models/settingsModel");
const featureModel = require("../models/featureDefinitionModel");
const planModel = require("../models/planModel");
const campaignModel = require("../models/campaignModel");
const subscriptionModel = require("../models/subscriptionModel");
const paymentModel = require("../models/paymentModel");
const { isValidFeatureKey, FEATURE_TYPES } = require("../constants/featureKeys");

function fail(res, err, action) {
  if (err.code === "INVALID_SETTING") {
    return error(res, 400, err.message, ERROR_CODES.BAD_REQUEST);
  }
  logError(`ADMIN_${action}_ERROR`, err, {});
  return error(res, 500, "Operation failed", ERROR_CODES.INTERNAL_ERROR);
}

// ---------- Settings ----------
const getSettingsController = async (_req, res) => {
  try {
    return ok(res, await settingsModel.getAllSettings());
  } catch (err) { return fail(res, err, "GET_SETTINGS"); }
};

const updateSettingsController = async (req, res) => {
  const updates = req.body || {};
  try {
    const before = await settingsModel.getAllSettings();
    for (const [key, value] of Object.entries(updates)) {
      await settingsService.updateSetting(key, value, req.user.id);
    }
    const after = await settingsModel.getAllSettings();
    await auditService.record({ req, action: "settings.update", entityType: "app_settings", before, after });
    return ok(res, after);
  } catch (err) { return fail(res, err, "UPDATE_SETTINGS"); }
};

// ---------- Feature Catalog ----------
const listFeaturesController = async (_req, res) => {
  try { return ok(res, await featureModel.listFeatures()); }
  catch (err) { return fail(res, err, "LIST_FEATURES"); }
};

const createFeatureController = async (req, res) => {
  const { key, displayName, description, type, defaultValue, enumOptions, category } = req.body || {};
  if (!isValidFeatureKey(key)) {
    return error(res, 400, "Invalid feature key (snake_case required, starts with a letter)", ERROR_CODES.BAD_REQUEST);
  }
  if (!FEATURE_TYPES.includes(type)) {
    return error(res, 400, `Invalid type. Allowed: ${FEATURE_TYPES.join(", ")}`, ERROR_CODES.BAD_REQUEST);
  }
  if (!displayName) return error(res, 400, "displayName is required", ERROR_CODES.BAD_REQUEST);
  try {
    const existing = await featureModel.getFeatureByKey(key);
    if (existing) return error(res, 409, "Feature key already exists", ERROR_CODES.BAD_REQUEST);
    const created = await featureModel.createFeature({ key, displayName, description, type, defaultValue, enumOptions, category });
    await auditService.record({ req, action: "feature.create", entityType: "feature_definitions", entityId: created.id, after: created });
    return ok(res, created);
  } catch (err) { return fail(res, err, "CREATE_FEATURE"); }
};

const updateFeatureController = async (req, res) => {
  try {
    const before = await featureModel.getFeatureById(req.params.id);
    if (!before) return error(res, 404, "Feature not found", ERROR_CODES.NOT_FOUND);
    // key and type are immutable.
    const { displayName, description, defaultValue, enumOptions, category, isActive } = req.body || {};
    const updated = await featureModel.updateFeature(req.params.id, { displayName, description, defaultValue, enumOptions, category, isActive });
    await auditService.record({ req, action: "feature.update", entityType: "feature_definitions", entityId: req.params.id, before, after: updated });
    return ok(res, updated);
  } catch (err) { return fail(res, err, "UPDATE_FEATURE"); }
};

// ---------- Plans ----------
const listPlansController = async (_req, res) => {
  try {
    const plans = await planModel.listPlans();
    const detailed = [];
    for (const p of plans) {
      const [pricePoints, features, entitlements, onboarding] = await Promise.all([
        planModel.listPricePoints(p.id),
        planModel.listPlanFeatures(p.id),
        planModel.listPlanEntitlements(p.id),
        planModel.getOnboardingFlow(p.id),
      ]);
      detailed.push({ ...p, pricePoints, features, entitlements, onboarding });
    }
    return ok(res, detailed);
  } catch (err) { return fail(res, err, "LIST_PLANS"); }
};

const createPlanController = async (req, res) => {
  const { slug } = req.body || {};
  if (!isValidFeatureKey(slug)) {
    return error(res, 400, "Invalid plan slug (snake_case required)", ERROR_CODES.BAD_REQUEST);
  }
  try {
    const created = await planModel.createPlan(req.body);
    await auditService.record({ req, action: "plan.create", entityType: "plans", entityId: created.id, after: created });
    return ok(res, created);
  } catch (err) { return fail(res, err, "CREATE_PLAN"); }
};

const updatePlanController = async (req, res) => {
  try {
    const before = await planModel.getPlanById(req.params.id);
    if (!before) return error(res, 404, "Plan not found", ERROR_CODES.NOT_FOUND);
    const updated = await planModel.updatePlan(req.params.id, req.body || {});
    await auditService.record({ req, action: "plan.update", entityType: "plans", entityId: req.params.id, before, after: updated });
    return ok(res, updated);
  } catch (err) { return fail(res, err, "UPDATE_PLAN"); }
};

const createPricePointController = async (req, res) => {
  try {
    const created = await planModel.createPricePoint({ planId: req.params.id, ...req.body });
    await auditService.record({ req, action: "price_point.create", entityType: "plan_price_points", entityId: created.id, after: created });
    return ok(res, created);
  } catch (err) { return fail(res, err, "CREATE_PRICE_POINT"); }
};

const replaceFeaturesController = async (req, res) => {
  try {
    const features = Array.isArray(req.body?.features) ? req.body.features : [];
    const result = await planModel.replacePlanFeatures(req.params.id, features);
    await auditService.record({ req, action: "plan_features.replace", entityType: "plan_features", entityId: req.params.id, after: result });
    return ok(res, result);
  } catch (err) { return fail(res, err, "REPLACE_FEATURES"); }
};

const getEntitlementsController = async (req, res) => {
  try { return ok(res, await planModel.listPlanEntitlements(req.params.id)); }
  catch (err) { return fail(res, err, "GET_ENTITLEMENTS"); }
};

const updateEntitlementsController = async (req, res) => {
  // Body: { entitlements: [{ featureKey, value }] }
  const items = Array.isArray(req.body?.entitlements) ? req.body.entitlements : [];
  try {
    const before = await planModel.listPlanEntitlements(req.params.id);
    for (const item of items) {
      const feature = await featureModel.getFeatureByKey(item.featureKey);
      if (!feature) {
        return error(res, 400, `Unknown feature key: ${item.featureKey}`, ERROR_CODES.BAD_REQUEST);
      }
      const validation = validateEntitlementValue(feature, item.value);
      if (!validation.ok) return error(res, 400, validation.message, ERROR_CODES.BAD_REQUEST);
      await planModel.upsertPlanEntitlement(req.params.id, feature.id, item.value, req.user.id);
    }
    const after = await planModel.listPlanEntitlements(req.params.id);
    await auditService.record({ req, action: "plan_entitlements.update", entityType: "plan_entitlements", entityId: req.params.id, before, after });
    return ok(res, after);
  } catch (err) { return fail(res, err, "UPDATE_ENTITLEMENTS"); }
};

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

const updateOnboardingController = async (req, res) => {
  try {
    const steps = Array.isArray(req.body?.steps) ? req.body.steps : [];
    const before = await planModel.getOnboardingFlow(req.params.id);
    const result = await planModel.upsertOnboardingFlow(req.params.id, steps, req.user.id);
    await auditService.record({ req, action: "onboarding_flow.update", entityType: "onboarding_flows", entityId: req.params.id, before, after: result });
    return ok(res, result);
  } catch (err) { return fail(res, err, "UPDATE_ONBOARDING"); }
};

const comparePlansController = async (req, res) => {
  try {
    const diff = await planComparisonService.compare(req.query.from || null, req.query.to);
    return ok(res, diff);
  } catch (err) { return fail(res, err, "COMPARE_PLANS"); }
};

// ---------- Campaigns ----------
const listCampaignsController = async (_req, res) => {
  try { return ok(res, await campaignModel.listCampaigns()); }
  catch (err) { return fail(res, err, "LIST_CAMPAIGNS"); }
};

const createCampaignController = async (req, res) => {
  try {
    const created = await campaignModel.createCampaign(req.body || {});
    await auditService.record({ req, action: "campaign.create", entityType: "campaigns", entityId: created.id, after: created });
    return ok(res, created);
  } catch (err) { return fail(res, err, "CREATE_CAMPAIGN"); }
};

const updateCampaignController = async (req, res) => {
  try {
    const before = await campaignModel.getById(req.params.id);
    if (!before) return error(res, 404, "Campaign not found", ERROR_CODES.NOT_FOUND);
    const updated = await campaignModel.updateCampaign(req.params.id, req.body || {});
    await auditService.record({ req, action: "campaign.update", entityType: "campaigns", entityId: req.params.id, before, after: updated });
    return ok(res, updated);
  } catch (err) { return fail(res, err, "UPDATE_CAMPAIGN"); }
};

// ---------- Subscriptions ops ----------
const listSubscriptionsController = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Number(req.query.offset) || 0;
    return ok(res, await subscriptionModel.listAll({ limit, offset }));
  } catch (err) { return fail(res, err, "LIST_SUBSCRIPTIONS"); }
};

const subscriptionActionController = async (req, res) => {
  const { userId } = req.params;
  const { action } = req.params;
  const body = req.body || {};
  try {
    let result;
    if (action === "grant" || action === "grant-days" || action === "extend") {
      const days = Number(body.days);
      if (!days || days <= 0) return error(res, 400, "days must be a positive number", ERROR_CODES.BAD_REQUEST);
      let planId = body.planId;
      if (!planId && body.planSlug) planId = (await planModel.getPlanBySlug(body.planSlug))?.id;
      if (!planId) {
        const live = await subscriptionModel.getLiveSubscription(userId);
        planId = live?.planId;
      }
      if (!planId) return error(res, 400, "planSlug/planId required for new grant", ERROR_CODES.BAD_REQUEST);
      result = await subscriptionService.adminGrant({ userId, planId, days });
    } else if (action === "switch-plan") {
      const plan = body.planSlug ? await planModel.getPlanBySlug(body.planSlug) : await planModel.getPlanById(body.planId);
      if (!plan) return error(res, 400, "Unknown target plan", ERROR_CODES.BAD_REQUEST);
      result = await subscriptionService.switchPlan({ userId, newPlanId: plan.id });
    } else if (action === "cancel") {
      result = await subscriptionService.cancel({ userId, immediate: Boolean(body.immediate) });
    } else {
      return error(res, 400, `Unknown action: ${action}`, ERROR_CODES.BAD_REQUEST);
    }
    await auditService.record({ req, action: `subscription.${action}`, entityType: "user_subscriptions", entityId: userId, after: result });
    return ok(res, result);
  } catch (err) {
    if (err.code === "NO_ACTIVE_SUBSCRIPTION") {
      return sendError(res, { status: 409, code: err.code, message: err.message, retryable: false });
    }
    return fail(res, err, "SUBSCRIPTION_ACTION");
  }
};

// ---------- Billing ----------
const listPaymentsController = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Number(req.query.offset) || 0;
    return ok(res, await paymentModel.listPayments({ limit, offset }));
  } catch (err) { return fail(res, err, "LIST_PAYMENTS"); }
};

module.exports = {
  getSettingsController,
  updateSettingsController,
  listFeaturesController,
  createFeatureController,
  updateFeatureController,
  listPlansController,
  createPlanController,
  updatePlanController,
  createPricePointController,
  replaceFeaturesController,
  getEntitlementsController,
  updateEntitlementsController,
  updateOnboardingController,
  comparePlansController,
  listCampaignsController,
  createCampaignController,
  updateCampaignController,
  listSubscriptionsController,
  subscriptionActionController,
  listPaymentsController,
};
