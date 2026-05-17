const { autoApply } = require("../services/autoApplyService");
const { error, ok, ERROR_CODES } = require("../utils/response");
const { logError } = require("../utils/logger");

const autoApplyController = async (req, res) => {
  const reqId = req.requestId || "UNKNOWN";
  const userId = req.user.id;

  try {
    const { jobDescription } = req.body;

    if (!jobDescription || typeof jobDescription !== "string" || jobDescription.trim().length === 0) {
      return error(res, 400, "jobDescription must be a non-empty string", ERROR_CODES.BAD_REQUEST);
    }

    if (jobDescription.length > 10000) {
      return error(res, 400, "jobDescription exceeds 10000 characters", ERROR_CODES.BAD_REQUEST);
    }

    const result = await autoApply(userId, jobDescription, reqId);

    if (result.status === "needs_review") {
      return ok(res, result);
    }

    // HTTP 202 Accepted for async queued tasks
    return res.status(202).json(result);

  } catch (err) {
    let status = 500;
    let errorCode = ERROR_CODES.INTERNAL_ERROR;
    let message = "An internal error occurred.";

    if (err.code === "DEFAULTS_NOT_CONFIGURED" || err.code === "NO_CREDENTIALS") {
      status = 400;
      errorCode = err.code;
      message = err.message;
    } else if (err.code === "RESUME_NOT_FOUND") {
      status = 404;
      errorCode = err.code;
      message = err.message;
    } else if (err.code === "DUPLICATE_APPLICATION") {
      status = 409;
      errorCode = err.code;
      message = err.message;
    } else if (err.code === "QUEUE_FAILED") {
      status = 500;
      errorCode = err.code;
      message = err.message;
    } else if (err.name === "RetryableError" || err.name === "NonRetryableError") {
      // JD Parse or Email Gen failure
      status = 503;
      errorCode = "SERVICE_UNAVAILABLE";
      message = "AI Service temporarily unavailable. Please try again later.";
    }

    logError("AUTO_APPLY_CONTROLLER_ERROR", err, { reqId, userId });

    return error(res, status, message, errorCode);
  }
};

module.exports = {
  autoApplyController
};
