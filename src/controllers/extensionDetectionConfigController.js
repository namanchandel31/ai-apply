const { ok, error, ERROR_CODES } = require("../utils/response");
const { logError } = require("../utils/logger");
const {
  getDetectionConfig,
  updateDetectionConfig,
} = require("../models/extensionDetectionConfigModel");

function validateKeywordArray(value, fieldName) {
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
    const err = new Error(`${fieldName} must be an array of strings`);
    err.code = "BAD_REQUEST";
    throw err;
  }
}

function validateScore(value, fieldName) {
  if (!Number.isInteger(value) || value < 0 || value > 1000) {
    const err = new Error(`${fieldName} must be an integer between 0 and 1000`);
    err.code = "BAD_REQUEST";
    throw err;
  }
}

const getDetectionConfigController = async (req, res) => {
  try {
    const config = await getDetectionConfig();
    if (!config) {
      return error(res, 404, "Detection config not found", ERROR_CODES.NOT_FOUND);
    }
    return ok(res, config);
  } catch (err) {
    logError("GET_DETECTION_CONFIG_ERROR", err, { reqId: req.requestId });
    return error(res, 500, "Failed to fetch detection config", ERROR_CODES.INTERNAL_ERROR);
  }
};

const putAdminDetectionConfigController = async (req, res) => {
  try {
    const body = req.body || {};
    const patch = {};

    if (body.hiringKeywords !== undefined) {
      validateKeywordArray(body.hiringKeywords, "hiringKeywords");
      patch.hiringKeywords = body.hiringKeywords.map((s) => s.trim()).filter(Boolean);
    }
    if (body.applyKeywords !== undefined) {
      validateKeywordArray(body.applyKeywords, "applyKeywords");
      patch.applyKeywords = body.applyKeywords.map((s) => s.trim()).filter(Boolean);
    }
    if (body.blockedEmailPrefixes !== undefined) {
      validateKeywordArray(body.blockedEmailPrefixes, "blockedEmailPrefixes");
      patch.blockedEmailPrefixes = body.blockedEmailPrefixes.map((s) => s.trim()).filter(Boolean);
    }
    if (body.scoreEmail !== undefined) {
      validateScore(body.scoreEmail, "scoreEmail");
      patch.scoreEmail = body.scoreEmail;
    }
    if (body.scoreHiringKeyword !== undefined) {
      validateScore(body.scoreHiringKeyword, "scoreHiringKeyword");
      patch.scoreHiringKeyword = body.scoreHiringKeyword;
    }
    if (body.scoreApplyKeyword !== undefined) {
      validateScore(body.scoreApplyKeyword, "scoreApplyKeyword");
      patch.scoreApplyKeyword = body.scoreApplyKeyword;
    }
    if (body.threshold !== undefined) {
      validateScore(body.threshold, "threshold");
      patch.threshold = body.threshold;
    }

    if (!Object.keys(patch).length) {
      return error(res, 400, "No valid fields to update", ERROR_CODES.BAD_REQUEST);
    }

    const config = await updateDetectionConfig(patch);
    return ok(res, config);
  } catch (err) {
    if (err.code === "BAD_REQUEST") {
      return error(res, 400, err.message, ERROR_CODES.BAD_REQUEST);
    }
    logError("PUT_DETECTION_CONFIG_ERROR", err, { reqId: req.requestId });
    return error(res, 500, "Failed to update detection config", ERROR_CODES.INTERNAL_ERROR);
  }
};

module.exports = {
  getDetectionConfigController,
  putAdminDetectionConfigController,
};
