const crypto = require("crypto");
const { processJDJob } = require("../services/jobHandler");
const { RetryableError } = require("../utils/errors");
const { logInfo, logError } = require("../utils/logger");

const uploadJDController = async (req, res) => {
  const reqId = req.requestId || 'UNKNOWN';
  const jobId = crypto.randomUUID();

  try {
    const { text, title } = req.body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Request body must contain a non-empty 'text' field",
      });
    }

    // JD Hash (Normalization + Hashing)
    const normalizedText = text.trim().toLowerCase().replace(/\s+/g, ' ');
    const fileHash = crypto.createHash('sha256').update(normalizedText).digest('hex');

    logInfo("request_start", { reqId, jobId, fileHash, source: "jd" });

    // (Note: Optional JD dedup check can go here if a JD find-by-hash is added later)

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new RetryableError("request_timeout")), 20000)
    );

    const jobPromise = processJDJob({
      reqId,
      jobId,
      title: title || null,
      text,
      fileHash
    });

    const result = await Promise.race([jobPromise, timeoutPromise]);

    const { _dbIds, ...parsedData } = result.data;

    logInfo("request_end", { reqId, jobId, fileHash, source: "jd" });

    return res.status(200).json({
      success: true,
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

    return res.status(status).json({
      success: false,
      message: message,
    });
  }
};

module.exports = {
  uploadJDController,
};
