const { ok, error, ERROR_CODES } = require('../utils/response');
const { sendError } = require('../utils/httpErrorResponse');
const { logError, logInfo } = require('../utils/logger');
const { isTransientPgError } = require('../utils/pgErrors');
const { buildSetupStatus } = require('../services/setupStatusService');
const { buildUserMeResponse } = require('../services/userMeService');
const {
  updateUserProfile,
  seedProfileFromEmail,
} = require('../models/userModel');
const { deriveNameFromEmail } = require('../utils/deriveNameFromEmail');

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

const patchProfileController = async (req, res) => {
  const userId = req.user.id;
  const { firstName, lastName } = req.body || {};

  if (firstName === undefined && lastName === undefined) {
    return error(res, 400, 'firstName or lastName required', ERROR_CODES.BAD_REQUEST);
  }

  try {
    const updated = await updateUserProfile(userId, {
      firstName: firstName ?? '',
      lastName: lastName ?? '',
    });
    if (!updated) {
      return error(res, 404, 'User not found', ERROR_CODES.NOT_FOUND);
    }
    const me = await buildUserMeResponse(userId);
    logInfo('USER_PROFILE_UPDATED', { userId, reqId: req.requestId });
    return ok(res, me);
  } catch (err) {
    logError('PATCH_PROFILE_ERROR', err, { userId, reqId: req.requestId });
    return error(res, 500, 'Failed to update profile', ERROR_CODES.INTERNAL_ERROR);
  }
};

const seedProfileFromEmailController = async (req, res) => {
  const userId = req.user.id;
  const email = req.user.email;

  try {
    const { firstName, lastName } = deriveNameFromEmail(email);
    if (!firstName) {
      const me = await buildUserMeResponse(userId);
      return ok(res, me);
    }
    await seedProfileFromEmail(userId, { firstName, lastName });
    const me = await buildUserMeResponse(userId);
    logInfo('USER_PROFILE_SEEDED_FROM_EMAIL', { userId, reqId: req.requestId });
    return ok(res, me);
  } catch (err) {
    logError('SEED_PROFILE_FROM_EMAIL_ERROR', err, { userId, reqId: req.requestId });
    return error(res, 500, 'Failed to seed profile', ERROR_CODES.INTERNAL_ERROR);
  }
};

module.exports = {
  getSetupStatusController,
  getMeController,
  patchProfileController,
  seedProfileFromEmailController,
};
