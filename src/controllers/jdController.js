const crypto = require("crypto");
const { enqueueJDParsing } = require("../services/jobHandler");
const { RetryableError } = require("../utils/errors");
const { logInfo, logError } = require("../utils/logger");
const { ok, ERROR_CODES } = require("../utils/response");
const { sendError } = require("../utils/httpErrorResponse");
const { buildLogContext } = require("../utils/buildLogContext");
const { isQuotaError, sendQuotaExceeded } = require("../utils/quotaErrorResponse");

const uploadJDController = async (req, res) => {
  const reqId = req.requestId || "UNKNOWN";
  const jobId = crypto.randomUUID();

  try {
    const { text, title } = req.body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return sendError(res, {
        status: 400,
        code: ERROR_CODES.BAD_REQUEST,
        message: "Request body must contain a non-empty 'text' field",
        retryable: false,
      });
    }

    const normalizedText = text.trim().toLowerCase().replace(/\s+/g, " ");
    const fileHash = crypto.createHash("sha256").update(normalizedText).digest("hex");

    logInfo("request_start", { reqId, jobId, fileHash, source: "jd" });

    const abortController = new AbortController();
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        abortController.abort("request_timeout");
        reject(new RetryableError("request_timeout"));
      }, 90000);
    });

    const jobPromise = enqueueJDParsing({
      reqId,
      jobId,
      title: title || null,
      text,
      fileHash,
      userId: req.user.id,
      signal: abortController.signal,
    });

    const result = await Promise.race([jobPromise, timeoutPromise]);
    clearTimeout(timeoutId);

    const { _dbIds, ...parsedData } = result.data;

    logInfo("request_end", { reqId, jobId, fileHash, source: "jd" });

    return ok(res, {
      jobId: result.jobId,
      status: result.status,
      jobDescriptionId: _dbIds?.jobDescriptionId,
      parsedJobDescriptionId: _dbIds?.parsedJobDescriptionId,
      data: parsedData,
      message: "Job description processed and stored successfully",
    });
  } catch (err) {
    if (isQuotaError(err)) {
      return sendQuotaExceeded(res, err);
    }

    logError(
      "controller_error",
      err,
      buildLogContext({ reqId, jobId, userId: req.user?.id, route: req.originalUrl, method: req.method })
    );

    if (err.message?.includes("request_timeout")) {
      return sendError(res, {
        status: 504,
        code: "TIMEOUT",
        message: "Request timed out",
        retryable: true,
      });
    }
    if (err.name === "NonRetryableError" || err.message?.includes("invalid_parsed_content")) {
      return sendError(res, {
        status: 400,
        code: ERROR_CODES.BAD_REQUEST,
        message: "Job description parsing failed",
        retryable: false,
      });
    }
    if (err.name === "RetryableError") {
      return sendError(res, {
        status: 503,
        code: "SERVICE_UNAVAILABLE",
        message: "Service temporarily unavailable. Please try again later.",
        retryable: true,
      });
    }

    return sendError(res, {
      status: 500,
      code: "JD_PROCESSING_FAILED",
      message: "Failed to process job description",
      retryable: true,
    });
  }
};

module.exports = {
  uploadJDController,
};
