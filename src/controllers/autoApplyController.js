const { startAutoApply } = require("../services/applicationOrchestrationService");
const { ok, ERROR_CODES } = require("../utils/response");
const { sendError } = require("../utils/httpErrorResponse");
const { logError } = require("../utils/logger");
const { buildLogContext } = require("../utils/buildLogContext");

const autoApplyController = async (req, res) => {
  const reqId = req.requestId || "UNKNOWN";
  const userId = req.user.id;

  try {
    const {
      jobDescription,
      resumeId: bodyResumeId,
      emailSubject,
      emailBody,
      sourcePlatform,
      sourceUrl,
      sourceEmail,
      discoveredAt,
      sourceCompanyName,
      sourceRecruiterName,
      sourcePostId,
    } = req.body;

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

    const trimmedSubject = typeof emailSubject === "string" ? emailSubject.trim() : "";
    const trimmedBody = typeof emailBody === "string" ? emailBody.trim() : "";
    const hasCustomEmail = Boolean(trimmedSubject || trimmedBody);

    if (hasCustomEmail) {
      if (!trimmedSubject || !trimmedBody) {
        return sendError(res, {
          status: 400,
          code: ERROR_CODES.BAD_REQUEST,
          message: "emailSubject and emailBody must both be non-empty strings when provided",
          retryable: false,
        });
      }
      if (trimmedSubject.length > 500) {
        return sendError(res, {
          status: 400,
          code: ERROR_CODES.BAD_REQUEST,
          message: "emailSubject exceeds 500 characters",
          retryable: false,
        });
      }
      if (trimmedBody.length > 20000) {
        return sendError(res, {
          status: 400,
          code: ERROR_CODES.BAD_REQUEST,
          message: "emailBody exceeds 20000 characters",
          retryable: false,
        });
      }
    }

    const result = await startAutoApply(userId, jobDescription, reqId, {
      resumeId: bodyResumeId,
      emailSubject: hasCustomEmail ? trimmedSubject : undefined,
      emailBody: hasCustomEmail ? trimmedBody : undefined,
      sourcePlatform: typeof sourcePlatform === "string" ? sourcePlatform.trim() || undefined : undefined,
      sourceUrl: typeof sourceUrl === "string" ? sourceUrl.trim() || undefined : undefined,
      sourceEmail: typeof sourceEmail === "string" ? sourceEmail.trim() || undefined : undefined,
      discoveredAt: discoveredAt ? new Date(discoveredAt) : undefined,
      sourceCompanyName:
        typeof sourceCompanyName === "string" ? sourceCompanyName.trim() || undefined : undefined,
      sourceRecruiterName:
        typeof sourceRecruiterName === "string" ? sourceRecruiterName.trim() || undefined : undefined,
      sourcePostId: typeof sourcePostId === "string" ? sourcePostId.trim() || undefined : undefined,
    });

    return res.status(202).json({
      success: true,
      applicationId: result.applicationId,
      status: result.status,
      jobId: result.jobId,
    });
  } catch (err) {
    logError(
      "AUTO_APPLY_CONTROLLER_ERROR",
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
            ? "A valid resume is required before auto apply"
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
    if (err.code === "DUPLICATE_APPLICATION") {
      return sendError(res, {
        status: 409,
        code: err.code,
        message: err.message,
        retryable: false,
      });
    }
    if (err.code === "ENQUEUE_AFTER_COMMIT_FAILED") {
      return sendError(res, {
        status: 503,
        code: err.code,
        message:
          "Application was created but could not be queued immediately. Recovery will retry shortly.",
        retryable: true,
        meta: err.applicationId ? { applicationId: err.applicationId } : undefined,
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

module.exports = { autoApplyController };
