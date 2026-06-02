const { ok, error, ERROR_CODES } = require('../utils/response');
const { sendError } = require('../utils/httpErrorResponse');
const { logError } = require('../utils/logger');
const { isTransientPgError } = require('../utils/pgErrors');
const { buildSetupStatus } = require('../services/setupStatusService');
const { buildUserMeResponse } = require('../services/userMeService');

const getSetupStatusController = async (req, res) => {
  const userId = req.user.id;
  try {
    const status = await buildSetupStatus(userId);
    return ok(res, status);
  } catch (err) {
    logError("GET_SETUP_STATUS_ERROR", err, { userId, reqId: req.requestId });
    if (isTransientPgError(err)) {
      return sendError(res, {
        status: 503,
        code: "SERVICE_UNAVAILABLE",
        message: "Database temporarily unavailable. Please retry.",
        retryable: true,
      });
    }
    return error(res, 500, "Failed to fetch setup status", ERROR_CODES.INTERNAL_ERROR);
  }
};

const getMeController = async (req, res) => {
  try {
    const me = await buildUserMeResponse(req.user.id);
    return ok(res, me);
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return sendError(res, {
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: 'User not found',
        retryable: false,
      });
    }
    logError('GET_ME_ERROR', err, { userId: req.user.id, reqId: req.requestId });
    return error(res, 500, 'Failed to fetch profile', ERROR_CODES.INTERNAL_ERROR);
  }
};

module.exports = {
  getSetupStatusController,
  getMeController,
};
