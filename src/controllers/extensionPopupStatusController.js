const { ok, error, ERROR_CODES } = require("../utils/response");
const { sendError } = require("../utils/httpErrorResponse");
const { logError } = require("../utils/logger");
const { isTransientPgError } = require("../utils/pgErrors");
const { buildExtensionPopupStatus } = require("../services/extensionPopupStatusService");

const getExtensionPopupStatusController = async (req, res) => {
  const userId = req.user.id;
  try {
    const status = await buildExtensionPopupStatus(userId);
    return ok(res, status);
  } catch (err) {
    logError("GET_EXTENSION_POPUP_STATUS_ERROR", err, { userId, reqId: req.requestId });
    if (isTransientPgError(err)) {
      return sendError(res, {
        status: 503,
        code: "SERVICE_UNAVAILABLE",
        message: "Database temporarily unavailable. Please retry.",
        retryable: true,
      });
    }
    return error(res, 500, "Failed to fetch extension popup status", ERROR_CODES.INTERNAL_ERROR);
  }
};

module.exports = {
  getExtensionPopupStatusController,
};
