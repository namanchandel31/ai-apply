const crypto = require("crypto");
const { pool } = require("../db");
const { withPgTransaction } = require("../db/pgClient");
const { createPlaceholderJobDescription } = require("../models/jdModel");
const { createApplication } = require("../models/applicationModel");
const { createJob } = require("../models/applicationJobModel");
const { recordEvent } = require("../models/applicationEventModel");
const { enqueueProcessApplicationJob } = require("../queues/processApplicationQueue");
const { resolveResumeForAutoApply } = require("./resolveResumeForAutoApply");
const { APPLICATION_STATUS } = require("../domain/applicationStatus/constants/uiStatuses");
const { logInfo, logError } = require("../utils/logger");
const { buildLogContext } = require("../utils/buildLogContext");
const { flushRealtimeAfterDbCommit } = require("../realtime/postCommitFlush");
const { enqueuePostCommitPublish } = require("../realtime/postCommitPublishQueue");

/**
 * Draft-first auto-apply — no AI in HTTP path.
 * DB transaction (application + job + events) is separate from BullMQ enqueue.
 */
async function startAutoApply(userId, jobDescriptionText, reqId, options = {}) {
  logInfo("application_created", { reqId, userId, event: "auto_apply_start" });

  const resolved = await resolveResumeForAutoApply(userId, options.resumeId);

  const { rows: credRows } = await pool.query(
    `SELECT 1 FROM user_email_credentials WHERE user_id = $1`,
    [userId]
  );
  if (!credRows.length) {
    const err = new Error("No SMTP credentials saved.");
    err.code = "NO_CREDENTIALS";
    throw err;
  }

  const applicationId = crypto.randomUUID();
  let dbJob;

  await withPgTransaction(pool, async (client) => {
    const { jobDescriptionId } = await createPlaceholderJobDescription(
      client,
      jobDescriptionText,
      userId
    );

    await createApplication({
      id: applicationId,
      resumeId: resolved.resumeId,
      jobDescriptionId,
      userId,
      client,
      applicationStatus: APPLICATION_STATUS.DRAFT,
      resumeSnapshotPath: resolved.filePath,
    });

    dbJob = await createJob(
      {
        applicationId,
        jobType: "ai_process",
        status: "queued",
      },
      client
    );

    await recordEvent(
      {
        applicationId,
        eventType: "application_created",
        actorType: "user",
        actorId: String(userId),
        metadata: { reqId, resumeId: resolved.resumeId },
      },
      client
    );

    await recordEvent(
      {
        applicationId,
        eventType: "process_job_queued",
        actorType: "system",
        actorId: reqId,
        metadata: { jobId: dbJob.id },
      },
      client
    );
  });

  enqueuePostCommitPublish(applicationId, userId, { source: "auto_apply" });
  await flushRealtimeAfterDbCommit([applicationId]);

  try {
    const { jobId } = await enqueueProcessApplicationJob(applicationId, userId, {
      dbJobId: dbJob.id,
    });

    logInfo(
      "job_queued",
      buildLogContext({ reqId, userId, applicationId, jobId: dbJob.id, queueName: "process-application" })
    );

    return {
      success: true,
      applicationId,
      status: APPLICATION_STATUS.DRAFT,
      jobId,
    };
  } catch (err) {
    logError(
      "ENQUEUE_AFTER_COMMIT_FAILED",
      err,
      buildLogContext({ reqId, userId, applicationId, jobId: dbJob.id, queueName: "process-application" })
    );
    const enqueueErr = new Error(
      "Application created but queue enqueue failed; recovery will retry"
    );
    enqueueErr.code = "ENQUEUE_AFTER_COMMIT_FAILED";
    enqueueErr.retryable = true;
    enqueueErr.applicationId = applicationId;
    throw enqueueErr;
  }
}

module.exports = { startAutoApply };
