const { ok, error, ERROR_CODES } = require("../utils/response");
const { logError } = require("../utils/logger");
const { getProvider } = require("../providers");
const { validateModelForProvider } = require("../services/modelValidation");
const { normalizeModelInput } = require("../utils/normalizeModelInput");
const modelCertificationConfig = require("../config/modelCertification.config");
const { runModelCertification } = require("../services/aiApplyCertificationService");
const modelCertificationRunModel = require("../models/modelCertificationRunModel");
const curatedAiModelModel = require("../models/curatedAiModelModel");

async function runCertificationController(req, res) {
  const reqId = req.requestId || "UNKNOWN";
  req.setTimeout(modelCertificationConfig.runTimeoutMs);
  res.setTimeout(modelCertificationConfig.runTimeoutMs);
  try {
    const provider = String(req.body.provider || "").trim().toLowerCase();
    const apiKey = String(req.body.apiKey || "").trim();
    const resumeSource = req.body.resumeSource === "upload" ? "upload" : "active";

    const modelNorm = normalizeModelInput(req.body.model, { required: true });
    if (!modelNorm.ok) {
      return error(res, 400, modelNorm.message, modelNorm.code || ERROR_CODES.BAD_REQUEST);
    }

    if (!provider || !apiKey) {
      return error(res, 400, "provider and apiKey are required", ERROR_CODES.BAD_REQUEST);
    }

    try {
      getProvider(provider);
    } catch {
      return error(res, 400, "Unknown provider", ERROR_CODES.BAD_REQUEST);
    }

    const validation = validateModelForProvider({
      provider,
      model: modelNorm.model,
      providerType: "remote",
      task: "resume_parse",
    });
    if (!validation.valid) {
      return error(res, 400, validation.message, validation.code || ERROR_CODES.BAD_REQUEST);
    }

    const result = await runModelCertification({
      userId: req.user.id,
      provider,
      model: validation.model,
      apiKey,
      resumeSource,
      uploadBuffer: req.file?.buffer,
      reqId,
    });

    return ok(res, result);
  } catch (err) {
    logError("MODEL_CERTIFICATION_RUN_ERROR", err, { userId: req.user.id, reqId });
    try {
      const parsed = JSON.parse(err.message);
      if (parsed?.step && parsed?.message) {
        return res.status(400).json({
          success: false,
          error: parsed.message,
          code: ERROR_CODES.BAD_REQUEST,
          details: parsed,
        });
      }
    } catch {
      /* plain string error */
    }
    return error(res, 500, err.message || "Certification failed", ERROR_CODES.INTERNAL_ERROR);
  }
}

async function listRunsController(req, res) {
  try {
    const rows = await modelCertificationRunModel.listRunsForUser(req.user.id);
    return ok(res, { runs: rows });
  } catch (err) {
    logError("MODEL_CERTIFICATION_LIST_ERROR", err, { userId: req.user.id });
    return error(res, 500, "Failed to list runs", ERROR_CODES.INTERNAL_ERROR);
  }
}

async function listCuratedAdminController(req, res) {
  try {
    const models = await curatedAiModelModel.listCuratedForAdmin();
    return ok(res, { models });
  } catch (err) {
    logError("CURATED_MODELS_LIST_ERROR", err, { userId: req.user.id });
    return error(res, 500, "Failed to list curated models", ERROR_CODES.INTERNAL_ERROR);
  }
}

async function promoteCuratedController(req, res) {
  try {
    const { certificationRunId, displayName } = req.body;
    if (!certificationRunId) {
      return error(res, 400, "certificationRunId is required", ERROR_CODES.BAD_REQUEST);
    }

    const run = await modelCertificationRunModel.getRunById(certificationRunId, req.user.id);
    if (!run) {
      return error(res, 404, "Certification run not found", ERROR_CODES.NOT_FOUND);
    }

    const promoted = await curatedAiModelModel.promoteFromRun({
      run,
      displayName,
      userId: req.user.id,
    });

    return ok(res, { model: promoted });
  } catch (err) {
    logError("CURATED_PROMOTE_ERROR", err, { userId: req.user.id });
    return error(res, 500, "Failed to promote model", ERROR_CODES.INTERNAL_ERROR);
  }
}

async function patchCuratedController(req, res) {
  try {
    const { isActive, sortOrder } = req.body;
    const updated = await curatedAiModelModel.updateCurated(req.params.id, {
      isActive: typeof isActive === "boolean" ? isActive : undefined,
      sortOrder: typeof sortOrder === "number" ? sortOrder : undefined,
    });
    if (!updated) {
      return error(res, 404, "Curated model not found", ERROR_CODES.NOT_FOUND);
    }
    return ok(res, { model: updated });
  } catch (err) {
    logError("CURATED_PATCH_ERROR", err, { userId: req.user.id });
    return error(res, 500, "Failed to update curated model", ERROR_CODES.INTERNAL_ERROR);
  }
}

async function deleteCuratedController(req, res) {
  try {
    const updated = await curatedAiModelModel.deactivateCurated(req.params.id);
    if (!updated) {
      return error(res, 404, "Curated model not found", ERROR_CODES.NOT_FOUND);
    }
    return ok(res, { model: updated });
  } catch (err) {
    logError("CURATED_DELETE_ERROR", err, { userId: req.user.id });
    return error(res, 500, "Failed to deactivate curated model", ERROR_CODES.INTERNAL_ERROR);
  }
}

async function listCuratedModelsPublicController(req, res) {
  try {
    const provider = req.query.provider
      ? String(req.query.provider).trim().toLowerCase()
      : null;

    const models = provider
      ? await curatedAiModelModel.listActiveByProvider(provider)
      : await curatedAiModelModel.listAllActive();

    return ok(res, {
      models: models.map((m) => ({
        id: m.id,
        provider: m.provider,
        modelId: m.model_id,
        displayName: m.display_name,
      })),
    });
  } catch (err) {
    logError("CURATED_MODELS_PUBLIC_ERROR", err);
    return error(res, 500, "Failed to list models", ERROR_CODES.INTERNAL_ERROR);
  }
}

module.exports = {
  runCertificationController,
  listRunsController,
  listCuratedAdminController,
  promoteCuratedController,
  patchCuratedController,
  deleteCuratedController,
  listCuratedModelsPublicController,
};
