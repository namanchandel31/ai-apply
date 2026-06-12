const { ok, error, ERROR_CODES } = require("../utils/response");
const { logInfo, logError } = require("../utils/logger");
const { listAllProviders } = require("../providers");
const aiCredentialService = require("../services/aiCredentialService");
const aiCredentialModel = require("../models/aiCredentialModel");
const { healthCheck } = require("../services/aiGateway");
const { validateModelForProvider } = require("../services/modelValidation");
const { getProvider } = require("../providers");
const curatedAiModelModel = require("../models/curatedAiModelModel");

async function applyVerificationResult(userId, credentialId, health) {
  if (health.ok) {
    const row = await aiCredentialModel.updateCredentialVerification(credentialId, userId, {
      credentialStatus: "valid",
      lastValidatedAt: new Date(),
    });
    return { ok: true, row };
  }

  const isTimeout = health.code === "HEALTH_CHECK_TIMEOUT";
  await aiCredentialModel.updateCredentialVerification(credentialId, userId, {
    credentialStatus: "invalid",
    lastValidatedAt: null,
  });

  return {
    ok: false,
    code: isTimeout ? "AI_VALIDATION_TIMEOUT" : health.code || "CONNECTION_TEST_FAILED",
    message: isTimeout
      ? "Provider validation timed out"
      : health.error || "Connection test failed",
  };
}

const listProvidersController = async (_req, res) => {
  return ok(res, { providers: listAllProviders() });
};

const listCredentialsController = async (req, res) => {
  try {
    const rows = await aiCredentialService.listCredentials(req.user.id);
    return ok(res, rows);
  } catch (err) {
    logError("AI_CREDENTIALS_LIST_ERROR", err, { userId: req.user.id, reqId: req.requestId });
    return error(res, 500, "Failed to list AI credentials", ERROR_CODES.INTERNAL_ERROR);
  }
};

const saveCredentialController = async (req, res) => {
  const reqId = req.requestId || "UNKNOWN";
  try {
    const {
      provider,
      apiKey,
      selectedModel,
      baseUrl,
      label,
      allowPlatformFallback,
      providerType,
      role,
    } = req.body;

    if (!provider) {
      return error(res, 400, "provider is required", ERROR_CODES.BAD_REQUEST);
    }

    const adapter = getProvider(provider);
    const pType = providerType || adapter.providerType;

    const validation = validateModelForProvider({
      provider,
      model: selectedModel,
      providerType: pType,
      task: pType === "local" ? null : "resume_parse",
    });
    if (!validation.valid) {
      return error(res, 400, validation.message, validation.code || ERROR_CODES.BAD_REQUEST);
    }

    const hasCurated = await curatedAiModelModel.hasAnyActiveForProvider(provider);
    if (!hasCurated) {
      return error(
        res,
        400,
        "No certified models are available for this provider. Certify and promote a model first.",
        "NO_CURATED_MODELS"
      );
    }
    const allowed = await curatedAiModelModel.isModelAllowed(provider, validation.model);
    if (!allowed) {
      return error(
        res,
        400,
        "This model is not on the approved list. Choose a model from the dropdown.",
        "MODEL_NOT_CURATED"
      );
    }

    const saved = await aiCredentialService.saveCredential(req.user.id, {
      provider,
      apiKey,
      selectedModel: validation.model,
      baseUrl,
      label,
      allowPlatformFallback,
      providerType: pType,
      role: role || "primary",
    });

    const health = await healthCheck({
      userId: req.user.id,
      provider,
      credentialId: saved.id,
      model: validation.model,
      apiKey: pType === "remote" ? apiKey : undefined,
      baseUrl,
      providerType: pType,
    });

    const verification = await applyVerificationResult(req.user.id, saved.id, health);
    if (!verification.ok) {
      return error(res, 400, verification.message, verification.code);
    }

    logInfo("AI_CREDENTIAL_SAVED", {
      reqId,
      userId: req.user.id,
      provider,
      role: role || "primary",
      model: validation.model,
    });
    return ok(res, {
      ...verification.row,
      ...(validation.normalizedFrom ? { normalizedFrom: validation.normalizedFrom } : {}),
    });
  } catch (err) {
    logError("AI_CREDENTIAL_SAVE_ERROR", err, { userId: req.user.id, reqId });
    const code = err.code || ERROR_CODES.INTERNAL_ERROR;
    const status =
      code === "API_KEY_REQUIRED" ||
      code === "MODEL_REQUIRED" ||
      code === "INVALID_MODEL_FORMAT" ||
      code === "INVALID_PROVIDER"
        ? 400
        : 500;
    return error(res, status, err.message, code);
  }
};

const testCredentialController = async (req, res) => {
  try {
    const { provider, apiKey, selectedModel, baseUrl, providerType } = req.body;
    if (!provider) {
      return error(res, 400, "provider is required", ERROR_CODES.BAD_REQUEST);
    }

    const adapter = getProvider(provider);
    const pType = providerType || adapter.providerType;

    const validation = validateModelForProvider({
      provider,
      model: selectedModel,
      providerType: pType,
      task: pType === "local" ? null : "resume_parse",
    });
    if (!validation.valid) {
      return error(res, 400, validation.message, validation.code || ERROR_CODES.BAD_REQUEST);
    }

    const hasCurated = await curatedAiModelModel.hasAnyActiveForProvider(provider);
    if (!hasCurated) {
      return error(
        res,
        400,
        "No certified models are available for this provider. Certify and promote a model first.",
        "NO_CURATED_MODELS"
      );
    }
    const allowed = await curatedAiModelModel.isModelAllowed(provider, validation.model);
    if (!allowed) {
      return error(
        res,
        400,
        "This model is not on the approved list. Choose a model from the dropdown.",
        "MODEL_NOT_CURATED"
      );
    }

    const health = await healthCheck({
      userId: req.user.id,
      provider,
      model: validation.model,
      apiKey: pType === "remote" ? apiKey : undefined,
      baseUrl,
      providerType: pType,
    });

    return ok(res, {
      ...health,
      model: validation.model,
      ...(validation.normalizedFrom ? { normalizedFrom: validation.normalizedFrom } : {}),
    });
  } catch (err) {
    return error(res, 500, err.message, ERROR_CODES.INTERNAL_ERROR);
  }
};

const reorderChainController = async (req, res) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds) || !orderedIds.length) {
      return error(res, 400, "orderedIds array is required", ERROR_CODES.BAD_REQUEST);
    }
    const rows = await aiCredentialService.reorderCredentialChain(req.user.id, orderedIds);
    return ok(res, { credentials: rows.map(({ encryptedApiKey, ...r }) => r) });
  } catch (err) {
    const status = err.code === "INVALID_CHAIN_ORDER" ? 400 : 500;
    return error(res, status, err.message, err.code || ERROR_CODES.INTERNAL_ERROR);
  }
};

const patchCredentialController = async (req, res) => {
  try {
    const { inFallbackChain, label, selectedModel } = req.body;
    const { id } = req.params;

    if (inFallbackChain !== undefined) {
      const row = await aiCredentialService.setInFallbackChain(
        req.user.id,
        id,
        inFallbackChain
      );
      if (!row) {
        return error(res, 404, "Credential not found", ERROR_CODES.NOT_FOUND);
      }
    }

    return ok(res, { updated: true });
  } catch (err) {
    return error(res, 500, "Failed to update credential", ERROR_CODES.INTERNAL_ERROR);
  }
};

const healthCheckCredentialController = async (req, res) => {
  try {
    const aiCredentialModel = require("../models/aiCredentialModel");
    const row = await aiCredentialModel.getById(req.params.id, req.user.id);
    if (!row) {
      return error(res, 404, "Credential not found", ERROR_CODES.NOT_FOUND);
    }

    const { rowToCredential } = require("../services/aiCredentialService");
    const creds = rowToCredential(row);

    const health = await healthCheck({
      userId: req.user.id,
      provider: creds.provider,
      credentialId: row.id,
      model: creds.model,
      apiKey: creds.apiKey,
      baseUrl: creds.baseUrl,
      providerType: creds.providerType,
    });

    return ok(res, health);
  } catch (err) {
    return error(res, 500, err.message, ERROR_CODES.INTERNAL_ERROR);
  }
};

const activateCredentialController = async (req, res) => {
  try {
    const row = await aiCredentialService.activateCredential(req.user.id, req.params.id);
    if (!row) {
      return error(res, 404, "Credential not found", ERROR_CODES.NOT_FOUND);
    }
    return ok(res, { activated: true, credential: row });
  } catch (err) {
    return error(res, 500, "Failed to activate credential", ERROR_CODES.INTERNAL_ERROR);
  }
};

const deleteCredentialController = async (req, res) => {
  try {
    const deleted = await aiCredentialService.removeCredential(req.user.id, req.params.id);
    if (!deleted) {
      return error(res, 404, "Credential not found", ERROR_CODES.NOT_FOUND);
    }
    return ok(res, { deleted: true });
  } catch (err) {
    return error(res, 500, "Failed to delete credential", ERROR_CODES.INTERNAL_ERROR);
  }
};

module.exports = {
  listProvidersController,
  listCredentialsController,
  saveCredentialController,
  testCredentialController,
  reorderChainController,
  patchCredentialController,
  healthCheckCredentialController,
  activateCredentialController,
  deleteCredentialController,
};
