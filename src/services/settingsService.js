const config = require("../config");
const settingsModel = require("../models/settingsModel");

/**
 * Resolves effective global settings under the precedence:
 *   ENV kill-switch > Admin app_settings (DB) > defaults.
 * (Plan/campaign overlays are applied by their own services.)
 *
 * ENV can only FORCE-DISABLE the paywall (safety), never silently enable it.
 */

const PAYWALL_TRIGGERS = Object.freeze([
  "after_plan_selection",
  "after_onboarding",
  "before_first_apply",
]);

const DEFAULTS = Object.freeze({
  paywall_enabled: false,
  trials_enabled: true,
  checkout_enabled: true,
  registration_enabled: true,
  paywall_trigger: "after_plan_selection",
  grace_days: 0,
  subscriptions_enabled: false,
});

const CACHE_TTL_MS = 30_000;
let cache = null;
let cacheAt = 0;

function invalidate() {
  cache = null;
  cacheAt = 0;
}

async function loadSettings() {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_TTL_MS) return cache;
  let dbSettings = {};
  try {
    dbSettings = await settingsModel.getAllSettings();
  } catch {
    dbSettings = {};
  }
  cache = { ...DEFAULTS, ...dbSettings };
  cacheAt = now;
  return cache;
}

/**
 * Is the paywall active right now? ENV PRICING_ENABLED=false force-disables it
 * regardless of the DB setting (kill-switch).
 */
async function isPaywallEnabled() {
  if (config.product.pricingEnabled === false) return false; // ENV kill-switch
  const settings = await loadSettings();
  return Boolean(settings.paywall_enabled);
}

async function getPaywallTrigger() {
  const settings = await loadSettings();
  const trigger = settings.paywall_trigger;
  return PAYWALL_TRIGGERS.includes(trigger) ? trigger : DEFAULTS.paywall_trigger;
}

async function get(key) {
  const settings = await loadSettings();
  return settings[key];
}

async function getPublicSettings() {
  const settings = await loadSettings();
  return {
    paywallEnabled: await isPaywallEnabled(),
    paywallTrigger: await getPaywallTrigger(),
    trialsEnabled: Boolean(settings.trials_enabled),
    checkoutEnabled: Boolean(settings.checkout_enabled),
    registrationEnabled: Boolean(settings.registration_enabled),
    graceDays: Number(settings.grace_days) || 0,
  };
}

/** Admin update with validation; invalidates cache. */
async function updateSetting(key, value, updatedBy = null) {
  if (key === "paywall_trigger" && !PAYWALL_TRIGGERS.includes(value)) {
    const err = new Error(`Invalid paywall_trigger. Allowed: ${PAYWALL_TRIGGERS.join(", ")}`);
    err.code = "INVALID_SETTING";
    throw err;
  }
  const result = await settingsModel.upsertSetting(key, value, updatedBy);
  invalidate();
  return result;
}

module.exports = {
  PAYWALL_TRIGGERS,
  DEFAULTS,
  invalidate,
  isPaywallEnabled,
  getPaywallTrigger,
  get,
  getPublicSettings,
  updateSetting,
  loadSettings,
};
