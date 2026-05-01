const crypto = require("crypto");
const { processResumeJob } = require("../services/jobHandler");
const { findResumeByHash } = require("../models/resumeModel");
const { RetryableError } = require("../utils/errors");
const { logError } = require("../utils/logger");

const uploadResumeController = async (req, res) => {
  const reqId = req.requestId || 'UNKNOWN';

  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'No file' });
    }
    // MIME type and size checks are handled by upload middleware, but we double-check sanity
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ success: false, message: 'Invalid mimetype' });
    }
    
    const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    
    // Deduplication check
    const existing = await findResumeByHash(fileHash);
    if (existing) {
      return res.status(200).json({
        success: true,
        resumeId: existing.resumeId,
        parsedResumeId: existing.parsedResumeId,
        data: existing.parsedJson,
        message: 'Resume retrieved from cache'
      });
    }

    // Wrap the handler with a 20s timeout guard
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new RetryableError("request_timeout")), 20000)
    );

    const jobPromise = processResumeJob({
      reqId,
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      size: req.file.size,
      fileHash
    });

    const result = await Promise.race([jobPromise, timeoutPromise]);

    // Format output (result._dbIds contains DB generated UUIDs)
    const { _dbIds, ...parsedData } = result.data;

    return res.status(200).json({
      success: true,
      jobId: result.jobId,
      status: result.status,
      resumeId: _dbIds?.resumeId,
      parsedResumeId: _dbIds?.parsedResumeId,
      data: parsedData,
      message: 'Resume processed and stored successfully'
    });

  } catch (error) {
    let status = 500;
    let message = 'Failed to process resume due to internal error.';

    if (error.message.includes('request_timeout')) {
        status = 504;
        message = 'Request timed out';
    } else if (error.name === "NonRetryableError" || error.message.includes("Extraction Failed") || error.message.includes("invalid_parsed_content")) {
        status = 400;
        message = `Parsing failed: ${error.message}`;
    } else if (error.name === "RetryableError") {
        status = 503;
        message = `Service unavailable: ${error.message}`;
    } else {
        message = `Processing error: ${error.message}`;
    }

    logError("controller_error", error, { reqId, stage: "controller", source: "resume" });
    
    return res.status(status).json({
      success: false,
      message: message,
    });
  }
};

module.exports = {
  uploadResumeController
};
