const curatedAiModelModel = require("../models/curatedAiModelModel");
const platformAiConfigModel = require("../models/platformAiConfigModel");

/**
 * Single read API over curated_ai_models for BYOK, OneTap AI, and future features.
 */
async function listActiveCertifiedModels({ provider } = {}) {
  const models = provider
    ? await curatedAiModelModel.listActiveByProvider(provider)
    : await curatedAiModelModel.listAllActive();
  return models.map((m) => ({
    id: m.id,
    provider: m.provider,
    modelId: m.model_id ?? m.modelId,
    displayName: m.display_name ?? m.displayName,
    overallScore: m.overall_score ?? m.overallScore,
    sortOrder: m.sort_order ?? m.sortOrder,
    certificationStatus: m.certification_status ?? "certified",
  }));
}

async function listActiveProviders() {
  const models = await curatedAiModelModel.listAllActive();
  return [...new Set(models.map((m) => m.provider))].sort();
}

async function isCertifiedAndActive(provider, modelId) {
  return curatedAiModelModel.isModelAllowed(provider, modelId);
}

async function getCertifiedModelById(id) {
  const row = await curatedAiModelModel.getById(id);
  if (!row || !row.is_active) return null;
  if (row.certification_status && row.certification_status !== "certified") return null;
  return row;
}

async function listAffectedPlatformRoutes(certifiedModelId) {
  const inUse = await platformAiConfigModel.usesCertifiedModel(certifiedModelId);
  return inUse ? [{ feature_key: "global" }] : [];
}

async function listDeprecationWarnings() {
  const inactive = await curatedAiModelModel.listInactiveOrDeprecated();
  const global = await platformAiConfigModel.getGlobalConfig();
  const warnings = [];
  for (const model of inactive) {
    if (global?.certified_model_id === model.id && global?.is_enabled) {
      warnings.push({
        certifiedModelId: model.id,
        provider: model.provider,
        modelId: model.model_id,
        displayName: model.display_name,
        certificationStatus: model.certification_status || (model.is_active ? "certified" : "revoked"),
        affectedFeatures: ["all"],
      });
    }
  }
  return warnings;
}

module.exports = {
  listActiveCertifiedModels,
  listActiveProviders,
  isCertifiedAndActive,
  getCertifiedModelById,
  listAffectedPlatformRoutes,
  listDeprecationWarnings,
};
