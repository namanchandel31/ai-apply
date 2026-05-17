const crypto = require("crypto");
const { processResumeJob } = require("../services/jobHandler");
const { findResumeByHash } = require("../models/resumeModel");
const { autoPopulateDefaultResume } = require("../models/userModel");
const { RetryableError } = require("../utils/errors");
const { logInfo, logError } = require("../utils/logger");
const { supabase } = require("../config/supabase");
const { error: sendError, ok, ERROR_CODES } = require("../utils/response");

const uploadResumeController = async (req, res) => {
  const reqId = req.requestId || 'UNKNOWN';
  const jobId = crypto.randomUUID();
  let userId = null;

  try {
    if (!req.file || !req.file.buffer) {
      return sendError(res, 400, 'No file', ERROR_CODES.BAD_REQUEST);
    }
    // MIME type and size checks are handled by upload middleware, but we double-check sanity
    if (req.file.mimetype !== 'application/pdf') {
      return sendError(res, 400, 'Invalid mimetype', ERROR_CODES.BAD_REQUEST);
    }
    
    const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    userId = req.user.id;
    const filePath = `${userId}/${fileHash}.pdf`;

    logInfo("request_start", { reqId, jobId, fileHash, userId, source: "resume" });
    
    // Deduplication check
    const existing = await findResumeByHash(fileHash, userId);
    if (existing) {
      logInfo("request_end", { reqId, jobId, fileHash, userId, cacheHit: true, source: "resume" });
      return ok(res, {
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

    // Upload to Supabase Storage
    try {
      const { error: storageError } = await supabase.storage
        .from('resumes')
        .upload(filePath, req.file.buffer, {
          contentType: 'application/pdf',
          upsert: false
        });
      
      if (storageError) {
        throw new Error(`Supabase upload failed: ${storageError.message}`);
      }
      
      logInfo("supabase_upload_success", { reqId, jobId, fileHash, userId, filePath });
    } catch (uploadError) {
      logError("supabase_upload_failed", uploadError, { reqId, jobId, fileHash, userId, filePath });
      return sendError(res, 500, 'Failed to upload file to storage', ERROR_CODES.INTERNAL_ERROR);
    }

    const jobPromise = processResumeJob({
      reqId,
      jobId,
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      size: req.file.size,
      fileHash,
      userId: req.user.id,
      filePath
    });

    const result = await Promise.race([jobPromise, timeoutPromise]);

    // Format output (result._dbIds contains DB generated UUIDs)
    const { _dbIds, ...parsedData } = result.data;

    logInfo("request_end", { reqId, jobId, fileHash, userId, source: "resume" });

    // Auto-populate default resume if not already set
    if (_dbIds?.resumeId) {
      try {
        await autoPopulateDefaultResume(userId, _dbIds.resumeId);
      } catch (dbErr) {
        logError("auto_populate_default_resume_failed", dbErr, { reqId, userId, resumeId: _dbIds.resumeId });
      }
    }

    return ok(res, {
      jobId: result.jobId,
      status: result.status,
      resumeId: _dbIds?.resumeId,
      parsedResumeId: _dbIds?.parsedResumeId,
      data: parsedData,
      message: 'Resume processed and stored successfully'
    });

  } catch (err) {
    let status = 500;
    let message = 'Failed to process resume due to internal error.';

    if (err.message?.includes('request_timeout')) {
      status = 504;
      message = 'Request timed out';
    } else if (
      err.name === "NonRetryableError" ||
      err.message?.includes("Extraction Failed") ||
      err.message?.includes("invalid_parsed_content")
    ) {
      status = 400;
      message = `Parsing failed: ${err.message}`;
    } else if (err.name === "RetryableError") {
      status = 503;
      message = `Service unavailable: ${err.message}`;
    } else {
      message = `Processing error: ${err.message}`;
    }

    logError("controller_error", err, {
      reqId,
      jobId,
      stage: "controller",
      source: "resume",
      userId,
      pgCode: err.code,
      detail: err.detail,
    });

    const errorCode =
      status === 400 ? ERROR_CODES.BAD_REQUEST :
      status === 504 ? 'TIMEOUT' :
      status === 503 ? 'SERVICE_UNAVAILABLE' :
      ERROR_CODES.INTERNAL_ERROR;

    return sendError(res, status, message, errorCode);
  }
};

module.exports = {
  uploadResumeController
};
