const { decrypt } = require("../utils/encryption");
const { NonRetryableError } = require("../utils/errors");
const settingsService = require("./settingsService");
const platformAiConfigModel = require("../models/platformAiConfigModel");
const curatedAiModelModel = require("../models/curatedAiModelModel");
const config = require("../config");
const { DEFAULT_MODELS } = require("../providers/providerUtils");

const CACHE_TTL_MS = 30_000;
let cache = { at: 0, global: null };

function invalidateCache() {
  cache = { at: 0, global: null };
}

function envBootstrapCredential(featureKey) {
  const provider = config.ai.DEFAULT_AI_PROVIDER || "openai";
  const apiKey = config.ai.openaiApiKey;
  if (!apiKey) return null;
  return {
    provider,
    providerType: "remote",
    apiKey,
    model: config.ai.DEFAULT_AI_MODEL || DEFAULT_MODELS[provider] || DEFAULT_MODELS.openai,
    baseUrl: null,
    credentialSource: "platform",
    credentialId: null,
    certifiedModelId: null,
    allowPlatformFallback: true,
    featureKey,
  };
}

async function loadGlobalConfig() {
  if (cache.global && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.global;
  }
  const global = await platformAiConfigModel.getGlobalConfig();
  cache = { at: Date.now(), global };
  return global;
}

function buildPlatformCredential(global, picked, featureKey) {
  const apiKey = picked.encrypted_api_key ? decrypt(picked.encrypted_api_key) : null;
  if (!apiKey) return null;
  return {
    provider: global.model_provider,
    providerType: "remote",
    apiKey,
    model: global.model_id,
    baseUrl: null,
    credentialSource: "platform",
    credentialId: picked.id,
    certifiedModelId: global.certified_model_id,
    allowPlatformFallback: true,
    featureKey,
  };
}

async function loadValidatedGlobalConfig() {
  const enabled = await settingsService.get("platform_ai_enabled");
  if (enabled === false) {
    throw new NonRetryableError("Platform AI is disabled", { code: "PLATFORM_AI_DISABLED" });
  }

  const global = await loadGlobalConfig();
  if (!global || !global.is_enabled) {
    throw new NonRetryableError("OneTap AI is not configured", { code: "PLATFORM_AI_NOT_CONFIGURED" });
  }

  if (!global.model_is_active || (global.certification_status && global.certification_status !== "certified")) {
    throw new NonRetryableError("Selected model is not certified", { code: "CERTIFIED_MODEL_UNAVAILABLE" });
  }

  return global;
}

async function resolveChain(featureKey) {
  const global = await loadValidatedGlobalConfig();
  const credPool = await platformAiConfigModel.listActiveCredentialsForProvider(global.model_provider);
  if (!credPool.length) {
    throw new NonRetryableError("No active platform API keys for the selected provider", {
      code: "PLATFORM_CREDENTIAL_INACTIVE",
    });
  }

  const primary = platformAiConfigModel.pickWeightedCredential(credPool);
  const ordered = [
    primary,
    ...credPool.filter((cred) => cred.id !== primary.id),
  ];

  const attempts = ordered
    .map((picked) => buildPlatformCredential(global, picked, featureKey))
    .filter(Boolean);

  if (!attempts.length) {
    throw new NonRetryableError("Platform API key missing", { code: "PLATFORM_AI_KEY_MISSING" });
  }

  return attempts;
}

async function resolve(featureKey) {
  const attempts = await resolveChain(featureKey);
  return attempts[0];
}

async function isConfigured() {
  try {
    await resolve("email_generate");
    return true;
  } catch {
    return false;
  }
}

/**
 * When the saved provider has no active keys, switch global config to the first
 * provider that still has keys (highest-scored certified model for that provider).
 */
async function maybeAutoFailoverGlobalConfig({ updatedBy } = {}) {
  const global = await platformAiConfigModel.getGlobalConfig();
  if (!global?.is_enabled || !global.model_provider) return null;

  const activeForSaved = await platformAiConfigModel.listActiveCredentialsForProvider(
    global.model_provider
  );
  if (activeForSaved.length > 0) return null;

  const allCreds = await platformAiConfigModel.listCredentials();
  const providersWithKeys = [
    ...new Set(
      allCreds
        .filter((c) => c.is_active && Number(c.traffic_weight) > 0)
        .map((c) => c.provider)
    ),
  ];
  if (!providersWithKeys.length) return null;

  for (const provider of providersWithKeys) {
    const models = await curatedAiModelModel.listActiveByProvider(provider);
    if (!models.length) continue;
    await platformAiConfigModel.upsertGlobalConfig({
      certifiedModelId: models[0].id,
      isEnabled: true,
      updatedBy: updatedBy || null,
    });
    invalidateCache();
    return platformAiConfigModel.getGlobalConfig();
  }
  return null;
}

module.exports = {
  resolve,
  resolveChain,
  invalidateCache,
  isConfigured,
  envBootstrapCredential,
  maybeAutoFailoverGlobalConfig,
};
