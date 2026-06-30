const crypto = require("crypto");
const { processResumeJob } = require("../services/jobHandler");
const { findResumeByHash, createResumeRecord } = require("../models/resumeModel");
const { enqueueResumeJob } = require("../services/resumeJobRegistry");
const { autoPopulateDefaultResume } = require("../models/userModel");
const { RetryableError } = require("../utils/errors");
const { logInfo, logError } = require("../utils/logger");
const { supabase } = require("../config/supabase");
const { error: sendError, ok, ERROR_CODES } = require("../utils/response");
const entitlementService = require("../services/entitlementService");
const { userHasVerifiedAiCredential } = require("../services/setupStatusService");
const { isQuotaError, sendQuotaExceeded } = require("../utils/quotaErrorResponse");

async function respondWithDuplicateResume(res, {
  reqId,
  jobId,
  fileHash,
  userId,
  context,
  existing,
}) {
  try {
    await autoPopulateDefaultResume(userId, existing.resumeId);
  } catch (dbErr) {
    logError("auto_populate_default_resume_failed", dbErr, {
      reqId,
      userId,
      resumeId: existing.resumeId,
      deduplicated: true,
    });
  }

  logInfo("RESUME_DUPLICATE_REUSED", {
    reqId,
    jobId,
    fileHash,
    userId,
    context,
    source: "resume",
    message: "Duplicate resume detected, using existing uploaded resume",
  });

  return res.status(200).json({
    success: true,
    deduplicated: true,
    resumeId: existing.resumeId,
    parsedResumeId: existing.parsedResumeId,
    data: existing.parsedJson,
    message: "This resume is already on file. It remains your active resume.",
  });
}

function enqueueBackgroundResumeParse({
  reqId,
  jobId,
  req,
  fileHash,
  userId,
  filePath,
  existingResumeId = null,
}) {
  enqueueResumeJob(jobId, userId, () =>
    processResumeJob({
      reqId,
      jobId,
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      size: req.file.size,
      fileHash,
      userId,
      filePath,
      existingResumeId,
    })
  );
}

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
      const canUseManaged = await entitlementService.hasEntitlement(userId, 'can_use_managed_ai');
      if (!hasVerified && !canUseManaged) {
        return sendError(
          res,
          403,
          'Verify your AI provider key or use OneTap AI before uploading a resume',
          'AI_CREDENTIAL_REQUIRED'
        );
      }
    }

    logInfo("request_start", { reqId, jobId, fileHash, userId, context, source: "resume" });

    // Deduplication check
    const existing = await findResumeByHash(fileHash, userId);
    if (existing?.parsedResumeId) {
      return respondWithDuplicateResume(res, {
        reqId,
        jobId,
        fileHash,
        userId,
        context,
        existing,
      });
    }

    const existingResumeId = existing?.resumeId ?? null;
    const resolvedFilePath = existing?.filePath ?? filePath;

    if (existingResumeId && context === "onboarding") {
      enqueueBackgroundResumeParse({
        reqId,
        jobId,
        req,
        fileHash,
        userId,
        filePath: resolvedFilePath,
        existingResumeId,
      });
      return res.status(202).json({
        success: true,
        data: {
          jobId,
          status: "processing",
          resumeId: existingResumeId,
          message: "Resume found. Parsing will continue in the background.",
        },
      });
    }

    logInfo("DEBUG_DUPLICATE_CHECK", {
      userId,
      fileHash,
      context,
      existingResumeFound: !!existingResumeId,
    });

    if (!existingResumeId) {
      // Upload to Supabase Storage
      try {
        const { error: storageError } = await supabase.storage
          .from('resumes')
          .upload(resolvedFilePath, req.file.buffer, {
            contentType: 'application/pdf',
            upsert: false
          });

        if (storageError) {
          const msg = storageError.message || '';
          if (msg.includes('The resource already exists')) {
            const doubleCheck = await findResumeByHash(fileHash, userId);
            if (doubleCheck?.parsedResumeId) {
              return respondWithDuplicateResume(res, {
                reqId,
                jobId,
                fileHash,
                userId,
                context,
                existing: doubleCheck,
              });
            }

            logInfo("RESUME_STORAGE_DB_RECONCILED", {
              reqId, jobId, fileHash, userId, filePath: resolvedFilePath, source: "resume",
              message: "Storage object existed without DB row, metadata reconciled successfully"
            });
          } else {
            throw new Error(`Supabase upload failed: ${storageError.message}`);
          }
        }

        logInfo("supabase_upload_success", { reqId, jobId, fileHash, userId, filePath: resolvedFilePath });
      } catch (uploadError) {
        logError("supabase_upload_failed", uploadError, { reqId, jobId, fileHash, userId, filePath: resolvedFilePath });
        return sendError(res, 500, 'Failed to upload file to storage', ERROR_CODES.INTERNAL_ERROR);
      }
    }

    if (context === "onboarding") {
      const resume = existingResumeId
        ? { id: existingResumeId }
        : await createResumeRecord(
            req.file.originalname,
            req.file.size,
            fileHash,
            userId,
            resolvedFilePath
          );

      try {
        await autoPopulateDefaultResume(userId, resume.id);
      } catch (dbErr) {
        logError("auto_populate_default_resume_failed", dbErr, { reqId, userId, resumeId: resume.id });
      }

      enqueueBackgroundResumeParse({
        reqId,
        jobId,
        req,
        fileHash,
        userId,
        filePath: resolvedFilePath,
        existingResumeId: resume.id,
      });

      logInfo("RESUME_UPLOAD_ASYNC", { reqId, jobId, fileHash, userId, context, source: "resume" });

      return res.status(202).json({
        success: true,
        data: {
          jobId,
          status: "processing",
          resumeId: resume.id,
          message: "Resume uploaded. Parsing will continue in the background.",
        },
      });
    }

    // profile_update: synchronous parse (new upload or re-parse of a previously failed duplicate)
    const abortController = new AbortController();
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        abortController.abort("request_timeout");
        reject(new RetryableError("request_timeout"));
      }, 90000);
    });

    const { enqueueResumeParsing } = require("../services/jobHandler");
    const jobPromise = enqueueResumeParsing({
      reqId,
      jobId,
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      size: req.file.size,
      fileHash,
      userId: req.user.id,
      filePath: resolvedFilePath,
      existingResumeId,
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
    if (isQuotaError(err)) {
      return sendQuotaExceeded(res, err);
    }

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
