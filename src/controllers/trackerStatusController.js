const {
  getTrackerStatusOptions,
  createTrackerStatusOption,
  deleteTrackerStatusOption,
  getTrackerStatusSummary,
  setApplicationTrackerStatus,
} = require("../services/trackerStatusService");
const { ok, ERROR_CODES } = require("../utils/response");
const { sendError } = require("../utils/httpErrorResponse");
const { logError } = require("../utils/logger");
const { buildLogContext } = require("../utils/buildLogContext");

async function listTrackerStatusesController(req, res) {
  try {
    const options = await getTrackerStatusOptions(req.user.id);
    return ok(res, { options });
  } catch (err) {
    logError("LIST_TRACKER_STATUSES_ERROR", err, buildLogContext({ userId: req.user.id }));
    return sendError(res, {
      status: 500,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: "Failed to load tracker statuses",
      retryable: false,
    });
  }
}

async function createTrackerStatusController(req, res) {
  try {
    const { name, color } = req.body || {};
    const option = await createTrackerStatusOption(req.user.id, { name, color });
    return ok(res, { option });
  } catch (err) {
    if (err.code === "BAD_REQUEST") {
      return sendError(res, {
        status: 400,
        code: ERROR_CODES.BAD_REQUEST,
        message: err.message,
        retryable: false,
      });
    }
    logError("CREATE_TRACKER_STATUS_ERROR", err, buildLogContext({ userId: req.user.id }));
    return sendError(res, {
      status: 500,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: "Failed to create tracker status",
      retryable: false,
    });
  }
}

async function getTrackerStatusSummaryController(req, res) {
  try {
    const summary = await getTrackerStatusSummary(req.user.id);
    return ok(res, summary);
  } catch (err) {
    logError("TRACKER_STATUS_SUMMARY_ERROR", err, buildLogContext({ userId: req.user.id }));
    return sendError(res, {
      status: 500,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: "Failed to load tracker status summary",
      retryable: false,
    });
  }
}

async function deleteTrackerStatusController(req, res) {
  try {
    const result = await deleteTrackerStatusOption(req.user.id, req.params.id);
    return ok(res, result);
  } catch (err) {
    if (err.code === "NOT_FOUND") {
      return sendError(res, {
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: "Tracker status not found",
        retryable: false,
      });
    }
    if (err.code === "BAD_REQUEST") {
      return sendError(res, {
        status: 400,
        code: ERROR_CODES.BAD_REQUEST,
        message: err.message,
        retryable: false,
      });
    }
    logError("DELETE_TRACKER_STATUS_ERROR", err, buildLogContext({
      userId: req.user.id,
      statusId: req.params.id,
    }));
    return sendError(res, {
      status: 500,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: "Failed to delete tracker status",
      retryable: false,
    });
  }
}

async function patchApplicationTrackerStatusController(req, res) {
  try {
    const { trackerStatusId } = req.body || {};
    const result = await setApplicationTrackerStatus(
      req.user.id,
      req.params.id,
      trackerStatusId ?? null
    );
    return ok(res, result);
  } catch (err) {
    if (err.code === "NOT_FOUND") {
      return sendError(res, {
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: "Application not found",
        retryable: false,
      });
    }
    if (err.code === "BAD_REQUEST") {
      return sendError(res, {
        status: 400,
        code: ERROR_CODES.BAD_REQUEST,
        message: err.message,
        retryable: false,
      });
    }
    logError("PATCH_APPLICATION_TRACKER_STATUS_ERROR", err, buildLogContext({
      userId: req.user.id,
      applicationId: req.params.id,
    }));
    return sendError(res, {
      status: 500,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: "Failed to update tracker status",
      retryable: false,
    });
  }
}

module.exports = {
  listTrackerStatusesController,
  createTrackerStatusController,
  deleteTrackerStatusController,
  getTrackerStatusSummaryController,
  patchApplicationTrackerStatusController,
};
