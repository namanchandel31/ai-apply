const crypto = require("crypto");
const { enqueueResumeParsing } = require("../services/jobHandler");
const { findResumeByHash } = require("../models/resumeModel");
const { autoPopulateDefaultResume } = require("../models/userModel");
const { RetryableError } = require("../utils/errors");
const { logInfo, logError } = require("../utils/logger");
const { supabase } = require("../config/supabase");
const { error: sendError, ok, ERROR_CODES } = require("../utils/response");
const { userHasVerifiedAiCredential } = require("../services/setupStatusService");

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

    const context = req.body.context || 'onboarding';
    if (!['onboarding', 'profile_update'].includes(context)) {
      return sendError(res, 400, 'Invalid context. Must be onboarding or profile_update', ERROR_CODES.BAD_REQUEST);
    }

    if (context === 'onboarding') {
      const hasVerified = await userHasVerifiedAiCredential(userId);
      if (!hasVerified) {
        return sendError(
          res,
          403,
          'Verify your AI provider key before uploading a resume',
          'AI_CREDENTIAL_REQUIRED'
        );
      }
    }

    logInfo("request_start", { reqId, jobId, fileHash, userId, context, source: "resume" });

    // Deduplication check
    const existing = await findResumeByHash(fileHash, userId);
    if (existing) {
      if (context === 'onboarding') {
        logInfo("RESUME_DUPLICATE_REUSED", { reqId, jobId, fileHash, userId, context, source: "resume", message: "Duplicate resume detected, using existing uploaded resume" });
        return res.status(200).json({
          success: true,
          deduplicated: true,
          resumeId: existing.resumeId,
          parsedResumeId: existing.parsedResumeId,
          data: existing.parsedJson,
          message: 'Duplicate resume detected. Using existing uploaded resume.'
        });
      } else {
        // profile_update
        logInfo("RESUME_DUPLICATE_REJECTED", { reqId, jobId, fileHash, userId, context, source: "resume", message: "Duplicate resume upload rejected during profile update" });
        return res.status(409).json({
          success: false,
          error: 'Duplicate resume detected. Please upload a new resume.'
        });
      }
    }

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

    // Add debug logging temporarily
    logInfo("DEBUG_DUPLICATE_CHECK", {
      userId,
      fileHash,
      context,
      existingResumeFound: !!existing
    });

    // Upload to Supabase Storage
    try {
      const { error: storageError } = await supabase.storage
        .from('resumes')
        .upload(filePath, req.file.buffer, {
          contentType: 'application/pdf',
          upsert: false
        });

      if (storageError) {
        const msg = storageError.message || '';
        if (msg.includes('The resource already exists')) {
          if (context === 'profile_update') {
            logInfo("RESUME_DUPLICATE_REJECTED", { reqId, jobId, fileHash, userId, context, source: "resume", message: "Duplicate resume upload rejected during profile update (orphaned storage)" });
            return res.status(409).json({
              success: false,
              error: 'Duplicate resume detected. Please upload a new resume.'
            });
          } else {
            // context === 'onboarding'
            // Re-query DB (race condition check)
            const doubleCheck = await findResumeByHash(fileHash, userId);
            if (doubleCheck) {
              logInfo("RESUME_DUPLICATE_REUSED", { reqId, jobId, fileHash, userId, context, source: "resume", message: "Duplicate resume detected (race condition), using existing uploaded resume" });
              return res.status(200).json({
                success: true,
                deduplicated: true,
                resumeId: doubleCheck.resumeId,
                parsedResumeId: doubleCheck.parsedResumeId,
                data: doubleCheck.parsedJson,
                message: 'Duplicate resume detected. Using existing uploaded resume.'
              });
            }

            // DB row DOES NOT exist: Storage object existed without DB row
            // We swallow the error and proceed to processResumeJob to recreate the DB metadata row.
            logInfo("RESUME_STORAGE_DB_RECONCILED", {
              reqId, jobId, fileHash, userId, filePath, source: "resume",
              message: "Storage object existed without DB row, metadata reconciled successfully"
            });
          }
        } else {
          throw new Error(`Supabase upload failed: ${storageError.message}`);
        }
      }

      logInfo("supabase_upload_success", { reqId, jobId, fileHash, userId, filePath });
    } catch (uploadError) {
      logError("supabase_upload_failed", uploadError, { reqId, jobId, fileHash, userId, filePath });
      return sendError(res, 500, 'Failed to upload file to storage', ERROR_CODES.INTERNAL_ERROR);
    }

    const jobPromise = enqueueResumeParsing({
      reqId,
      jobId,
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      size: req.file.size,
      fileHash,
      userId: req.user.id,
      filePath,
      signal: abortController.signal
    });

    const result = await Promise.race([jobPromise, timeoutPromise]);
    clearTimeout(timeoutId);

    // Format output (result._dbIds contains DB generated UUIDs)
    const { _dbIds, ...parsedData } = result.data;

    logInfo("RESUME_UPLOAD_NEW", { reqId, jobId, fileHash, userId, context, source: "resume" });

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
