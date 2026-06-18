const {
  bulkSetApplicationTrackerStatus,
  bulkDeleteApplications,
} = require("../services/applicationBulkService");
const { ok, ERROR_CODES } = require("../utils/response");
const { sendError } = require("../utils/httpErrorResponse");
const { logError } = require("../utils/logger");
const { buildLogContext } = require("../utils/buildLogContext");

function handleBulkError(res, err, req) {
  const map = {
    NOT_FOUND: 404,
    BAD_REQUEST: 400,
  };
  const status = map[err.code] || 500;
  const code = err.code || ERROR_CODES.INTERNAL_ERROR;
  const message =
    status < 500 ? err.message || "Request could not be completed" : "An internal error occurred.";

  if (status >= 500) {
    logError("APPLICATION_BULK_ERROR", err, buildLogContext({
      reqId: req.requestId,
      userId: req.user?.id,
      route: req.originalUrl,
      method: req.method,
    }));
  }

  return sendError(res, { status, code, message, retryable: status >= 500 });
}

async function bulkSetTrackerStatusController(req, res) {
  try {
    const { applicationIds, trackerStatusId } = req.body || {};
    const result = await bulkSetApplicationTrackerStatus(
      req.user.id,
      applicationIds,
      trackerStatusId ?? null,
      req.requestId
    );
    return ok(res, result);
  } catch (err) {
    return handleBulkError(res, err, req);
  }
}

async function bulkDeleteApplicationsController(req, res) {
  try {
    const { applicationIds } = req.body || {};
    const result = await bulkDeleteApplications(req.user.id, applicationIds, req.requestId);
    return ok(res, result);
  } catch (err) {
    return handleBulkError(res, err, req);
  }
}

module.exports = {
  bulkSetTrackerStatusController,
  bulkDeleteApplicationsController,
};
