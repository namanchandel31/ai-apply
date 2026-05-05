const crypto = require("crypto");
const { processResumeJob } = require("../services/jobHandler");
const { findResumeByHash } = require("../models/resumeModel");
const { RetryableError } = require("../utils/errors");
const { logInfo, logError } = require("../utils/logger");
const { getUserId } = require("../utils/auth");
const { supabase } = require("../config/supabase");

const uploadResumeController = async (req, res) => {
  const reqId = req.requestId || 'UNKNOWN';
  const jobId = crypto.randomUUID();

  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'No file' });
    }
    // MIME type and size checks are handled by upload middleware, but we double-check sanity
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ success: false, message: 'Invalid mimetype' });
    }
    
    const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    const userId = getUserId(req);
    const filePath = `${userId}/${fileHash}.pdf`;

    logInfo("request_start", { reqId, jobId, fileHash, userId, source: "resume" });
    
    // Deduplication check
    const existing = await findResumeByHash(fileHash);
    if (existing) {
      logInfo("request_end", { reqId, jobId, fileHash, userId, cacheHit: true, source: "resume" });
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

    // Upload to Supabase Storage
    try {
      const { error } = await supabase.storage
        .from('resumes')
        .upload(filePath, req.file.buffer, {
          contentType: 'application/pdf',
          upsert: false
        });
      
      if (error) {
        throw new Error(`Supabase upload failed: ${error.message}`);
      }
      
      logInfo("supabase_upload_success", { reqId, jobId, fileHash, userId, filePath });
    } catch (uploadError) {
      logError("supabase_upload_failed", uploadError, { reqId, jobId, fileHash, userId, filePath });
      return res.status(500).json({
        success: false,
        message: 'Failed to upload file to storage'
      });
    }

    const jobPromise = processResumeJob({
      reqId,
      jobId,
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      size: req.file.size,
      fileHash,
      userId,
      filePath
    });

    const result = await Promise.race([jobPromise, timeoutPromise]);

    // Format output (result._dbIds contains DB generated UUIDs)
    const { _dbIds, ...parsedData } = result.data;

    logInfo("request_end", { reqId, jobId, fileHash, userId, source: "resume" });

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

    logError("controller_error", error, { reqId, jobId, stage: "controller", source: "resume", userId });
    
    return res.status(status).json({
      success: false,
      message: message,
    });
  }
};

module.exports = {
  uploadResumeController
};
