const { ok, error, ERROR_CODES } = require("../utils/response");
const { logError } = require("../utils/logger");
const { encrypt } = require("../utils/encryption");
const platformAiConfigModel = require("../models/platformAiConfigModel");
const platformAiConfigService = require("../services/platformAiConfigService");
const certifiedModelCatalogService = require("../services/certifiedModelCatalogService");
const curatedAiModelModel = require("../models/curatedAiModelModel");
const auditService = require("../services/auditService");

async function listPlatformAiConfigController(req, res) {
  try {
    const [configRow, credentials, certifiedModels, deprecationResult] = await Promise.all([
      platformAiConfigModel.getGlobalConfig(),
      platformAiConfigModel.listCredentials(),
      certifiedModelCatalogService.listActiveCertifiedModels(),
      certifiedModelCatalogService.listDeprecationWarnings().catch((err) => {
        logError("ADMIN_PLATFORM_AI_DEPRECATION_WARNINGS_ERROR", err, { reqId: req.requestId });
        return [];
      }),
    ]);
    const deprecationWarnings = deprecationResult;
    return ok(res, { config: configRow, credentials, certifiedModels, deprecationWarnings });
  } catch (err) {
    logError("ADMIN_PLATFORM_AI_LIST_ERROR", err, { reqId: req.requestId });
    return error(res, 500, err.message, ERROR_CODES.INTERNAL_ERROR);
  }
}

async function upsertGlobalConfigController(req, res) {
  try {
    const certifiedModelId = req.body.certifiedModelId;
    const isEnabled = req.body.isEnabled !== false;
    if (!certifiedModelId) {
      return error(res, 400, "certifiedModelId is required", ERROR_CODES.BAD_REQUEST);
    }

    const model = await curatedAiModelModel.getById(certifiedModelId);
    if (!model?.is_active || (model.certification_status && model.certification_status !== "certified")) {
      return error(res, 400, "Selected model is not certified", ERROR_CODES.BAD_REQUEST);
    }

    const activeCreds = await platformAiConfigModel.listActiveCredentialsForProvider(model.provider);
    if (!activeCreds.length) {
      return error(
        res,
        400,
        `Add at least one active API key for ${model.provider} before saving this model`,
        ERROR_CODES.BAD_REQUEST
      );
    }

    const before = await platformAiConfigModel.getGlobalConfig();
    const row = await platformAiConfigModel.upsertGlobalConfig({
      certifiedModelId,
      isEnabled,
      updatedBy: req.user.id,
    });
    platformAiConfigService.invalidateCache();
    await auditService.record({
      req,
      action: "platform_ai_global.upsert",
      entityType: "platform_ai_global_config",
      entityId: "1",
      before,
      after: row,
    });
    return ok(res, { config: row });
  } catch (err) {
    logError("ADMIN_PLATFORM_GLOBAL_ERROR", err, { reqId: req.requestId });
    return error(res, 500, err.message, ERROR_CODES.INTERNAL_ERROR);
  }
}

async function createPlatformCredentialController(req, res) {
  try {
    const provider = String(req.body.provider || "").trim().toLowerCase();
    const label = req.body.label ? String(req.body.label).trim() : null;
    const apiKey = req.body.apiKey ? String(req.body.apiKey).trim() : null;
    const isActive = req.body.isActive !== false;
    const trafficWeight = Math.max(0, Number(req.body.trafficWeight) || 100);

    if (!provider) return error(res, 400, "provider is required", ERROR_CODES.BAD_REQUEST);
    if (!apiKey) return error(res, 400, "apiKey is required", ERROR_CODES.BAD_REQUEST);

    const row = await platformAiConfigModel.createCredential({
      provider,
      label,
      encryptedApiKey: encrypt(apiKey),
      isActive,
      trafficWeight,
    });
    platformAiConfigService.invalidateCache();
    await auditService.record({
      req,
      action: "platform_ai_credential.create",
      entityType: "platform_ai_credentials",
      entityId: row.id,
      before: null,
      after: { ...row, encrypted_api_key: "[redacted]" },
    });
    return ok(res, { credential: row });
  } catch (err) {
    logError("ADMIN_PLATFORM_CREDENTIAL_CREATE_ERROR", err, { reqId: req.requestId });
    return error(res, 500, err.message, ERROR_CODES.INTERNAL_ERROR);
  }
}

async function updatePlatformCredentialController(req, res) {
  try {
    const id = req.params.id;
    const before = await platformAiConfigModel.getCredentialById(id);
    if (!before) return error(res, 404, "Credential not found", ERROR_CODES.NOT_FOUND);

    const patch = {};
    if (req.body.label !== undefined) patch.label = req.body.label ? String(req.body.label).trim() : null;
    if (req.body.apiKey) patch.encryptedApiKey = encrypt(String(req.body.apiKey).trim());
    if (req.body.isActive !== undefined) patch.isActive = req.body.isActive !== false;
    if (req.body.trafficWeight !== undefined) {
      patch.trafficWeight = Math.max(0, Number(req.body.trafficWeight) || 0);
    }

    const row = await platformAiConfigModel.updateCredential(id, patch);
    await platformAiConfigService.maybeAutoFailoverGlobalConfig({ updatedBy: req.user.id });
    platformAiConfigService.invalidateCache();
    await auditService.record({
      req,
      action: "platform_ai_credential.update",
      entityType: "platform_ai_credentials",
      entityId: id,
      before: { ...before, encrypted_api_key: "[redacted]" },
      after: { ...row, encrypted_api_key: "[redacted]" },
    });
    return ok(res, { credential: row });
  } catch (err) {
    logError("ADMIN_PLATFORM_CREDENTIAL_UPDATE_ERROR", err, { reqId: req.requestId });
    return error(res, 500, err.message, ERROR_CODES.INTERNAL_ERROR);
  }
}

async function deletePlatformCredentialController(req, res) {
  try {
    const id = req.params.id;
    const before = await platformAiConfigModel.getCredentialById(id);
    if (!before) return error(res, 404, "Credential not found", ERROR_CODES.NOT_FOUND);

    const row = await platformAiConfigModel.deleteCredential(id);
    const failedOver = await platformAiConfigService.maybeAutoFailoverGlobalConfig({
      updatedBy: req.user.id,
    });
    platformAiConfigService.invalidateCache();
    await auditService.record({
      req,
      action: "platform_ai_credential.delete",
      entityType: "platform_ai_credentials",
      entityId: id,
      before: { ...before, encrypted_api_key: "[redacted]" },
      after: null,
    });
    return ok(res, { credential: row, autoFailover: failedOver ? true : false });
  } catch (err) {
    logError("ADMIN_PLATFORM_CREDENTIAL_DELETE_ERROR", err, { reqId: req.requestId });
    return error(res, 500, err.message, ERROR_CODES.INTERNAL_ERROR);
  }
}

module.exports = {
  listPlatformAiConfigController,
  upsertGlobalConfigController,
  createPlatformCredentialController,
  updatePlatformCredentialController,
  deletePlatformCredentialController,
};
