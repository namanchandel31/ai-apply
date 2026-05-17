const { getUserDefaults, setUserDefaults } = require("../models/userModel");
const { error, ok, ERROR_CODES } = require("../utils/response");
const { logError } = require("../utils/logger");

const getUserDefaultsController = async (req, res) => {
  const userId = req.user.id;
  try {
    const defaults = await getUserDefaults(userId);
    return ok(res, defaults || { defaultResumeId: null });
  } catch (err) {
    logError("GET_USER_DEFAULTS_ERROR", err, { userId });
    return error(res, 500, "Failed to fetch user defaults", ERROR_CODES.INTERNAL_ERROR);
  }
};

const setUserDefaultsController = async (req, res) => {
  const userId = req.user.id;
  const { defaultResumeId } = req.body;

  try {
    const updated = await setUserDefaults(userId, { defaultResumeId });
    return ok(res, { defaultResumeId: updated.default_resume_id });
  } catch (err) {
    if (err.message === "RESUME_NOT_FOUND_OR_NOT_OWNED") {
      return error(res, 404, "Resume not found or not owned by user", ERROR_CODES.NOT_FOUND);
    }
    logError("SET_USER_DEFAULTS_ERROR", err, { userId });
    return error(res, 500, "Failed to set user defaults", ERROR_CODES.INTERNAL_ERROR);
  }
};

module.exports = {
  getUserDefaultsController,
  setUserDefaultsController
};
