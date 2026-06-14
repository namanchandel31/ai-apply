const { previewApplicationEmail } = require("../services/previewEmailService");
const { ERROR_CODES } = require("../utils/response");
const { sendError } = require("../utils/httpErrorResponse");
const { logError } = require("../utils/logger");
const { buildLogContext } = require("../utils/buildLogContext");

const previewEmailController = async (req, res) => {
  const reqId = req.requestId || "UNKNOWN";
  const userId = req.user.id;

  try {
    const { jobDescription } = req.body;

    if (!jobDescription || typeof jobDescription !== "string" || !jobDescription.trim()) {
      return sendError(res, {
        status: 400,
        code: ERROR_CODES.BAD_REQUEST,
        message: "jobDescription must be a non-empty string",
        retryable: false,
      });
    }

    if (jobDescription.length > 10000) {
      return sendError(res, {
        status: 400,
        code: ERROR_CODES.BAD_REQUEST,
        message: "jobDescription exceeds 10000 characters",
        retryable: false,
      });
    }

    const result = await previewApplicationEmail(userId, jobDescription, reqId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    logError(
      "PREVIEW_EMAIL_CONTROLLER_ERROR",
      err,
      buildLogContext({ reqId, userId, route: req.originalUrl, method: req.method })
    );

    if (
      ["RESUME_REQUIRED", "RESUME_NOT_PARSED", "DEFAULTS_NOT_CONFIGURED", "NO_CREDENTIALS"].includes(
        err.code
      )
    ) {
      return sendError(res, {
        status: 400,
        code: err.code === "DEFAULTS_NOT_CONFIGURED" ? "RESUME_REQUIRED" : err.code,
        message:
          err.code === "RESUME_REQUIRED" || err.code === "DEFAULTS_NOT_CONFIGURED"
            ? "A valid resume is required before generating a preview"
            : err.message,
        retryable: false,
      });
    }
    if (err.code === "RESUME_NOT_FOUND") {
      return sendError(res, {
        status: 404,
        code: err.code,
        message: err.message,
        retryable: false,
      });
    }
    if (err.name === "RetryableError" || err.name === "NonRetryableError") {
      return sendError(res, {
        status: 503,
        code: "SERVICE_UNAVAILABLE",
        message: "AI Service temporarily unavailable. Please try again later.",
        retryable: true,
      });
    }

    return sendError(res, {
      status: 500,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: "An internal error occurred.",
      retryable: false,
    });
  }
};

module.exports = { previewEmailController };
