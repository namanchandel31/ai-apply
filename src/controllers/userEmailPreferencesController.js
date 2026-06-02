const { ok, error, ERROR_CODES } = require("../utils/response");
const { logError, logInfo } = require("../utils/logger");
const {
  getEmailPreferenceLevels,
  setEmailPreferenceLevels,
} = require("../models/userModel");
const { buildEmailPreferencesResponse } = require("../services/emailPreferenceMapper");

const getEmailPreferencesController = async (req, res) => {
  const userId = req.user.id;
  try {
    const levels = await getEmailPreferenceLevels(userId);
    if (!levels) {
      return error(res, 404, "User not found", ERROR_CODES.NOT_FOUND);
    }
    return ok(res, buildEmailPreferencesResponse(levels));
  } catch (err) {
    logError("GET_EMAIL_PREFERENCES_ERROR", err, { userId });
    return error(res, 500, "Failed to fetch email preferences", ERROR_CODES.INTERNAL_ERROR);
  }
};

const patchEmailPreferencesController = async (req, res) => {
  const userId = req.user.id;
  const { emailToneLevel, emailStructureLevel } = req.body || {};

  if (emailToneLevel === undefined && emailStructureLevel === undefined) {
    return error(res, 400, "emailToneLevel or emailStructureLevel required", ERROR_CODES.BAD_REQUEST);
  }

  try {
    const current = (await getEmailPreferenceLevels(userId)) || {
      emailToneLevel: 50,
      emailStructureLevel: 60,
    };
    const updated = await setEmailPreferenceLevels(userId, {
      emailToneLevel: emailToneLevel ?? current.emailToneLevel,
      emailStructureLevel: emailStructureLevel ?? current.emailStructureLevel,
    });
    if (!updated) {
      return error(res, 404, "User not found", ERROR_CODES.NOT_FOUND);
    }
    const response = buildEmailPreferencesResponse(updated);
    logInfo("EMAIL_PREFERENCES_UPDATED", {
      userId,
      ...response,
      reqId: req.requestId,
    });
    return ok(res, response);
  } catch (err) {
    logError("PATCH_EMAIL_PREFERENCES_ERROR", err, { userId });
    return error(res, 500, "Failed to update email preferences", ERROR_CODES.INTERNAL_ERROR);
  }
};

module.exports = {
  getEmailPreferencesController,
  patchEmailPreferencesController,
};
