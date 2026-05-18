const crypto = require("crypto");
const { enqueueJDParsing } = require("../services/jobHandler");
const { RetryableError } = require("../utils/errors");
const { logInfo, logError } = require("../utils/logger");
const { error, ok, ERROR_CODES } = require("../utils/response");

const uploadJDController = async (req, res) => {
  const reqId = req.requestId || 'UNKNOWN';
  const jobId = crypto.randomUUID();

  try {
    const { text, title } = req.body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return error(res, 400, "Request body must contain a non-empty 'text' field", ERROR_CODES.BAD_REQUEST);
    }

    // JD Hash (Normalization + Hashing)
    const normalizedText = text.trim().toLowerCase().replace(/\s+/g, ' ');
    const fileHash = crypto.createHash('sha256').update(normalizedText).digest('hex');

    logInfo("request_start", { reqId, jobId, fileHash, source: "jd" });

    // (Note: Optional JD dedup check can go here if a JD find-by-hash is added later)

    // Wrap the handler with a 90s timeout guard
    // TODO(async-migration): Current synchronous HTTP flow is acceptable temporarily,
    // but long-term scalability should migrate to:
    // Upload -> Queue -> Background Worker -> Polling/WebSocket status updates.
    // Do NOT implement async orchestration yet; focus on stabilizing retries first.
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
      signal: abortController.signal
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

  } catch (error) {
    let status = 500;
    let message = 'Failed to process job description due to internal error.';

    if (error.message.includes('request_timeout')) {
      status = 504;
      message = 'Request timed out';
    } else if (error.name === "NonRetryableError" || error.message.includes("invalid_parsed_content")) {
      status = 400;
      message = `Parsing failed: ${error.message}`;
    } else if (error.name === "RetryableError") {
      status = 503;
      message = `Service unavailable: ${error.message}`;
    }

    logError("controller_error", error, { reqId, jobId, stage: "controller", source: "jd" });

    const errorCode = status === 400 ? ERROR_CODES.BAD_REQUEST :
                      status === 504 ? 'TIMEOUT' :
                      status === 503 ? 'SERVICE_UNAVAILABLE' :
                      ERROR_CODES.INTERNAL_ERROR;

    return error(res, status, message, errorCode);
  }
};

module.exports = {
  uploadJDController,
};
