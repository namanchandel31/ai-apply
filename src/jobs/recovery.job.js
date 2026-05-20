const { pool } = require("../db");
const { logInfo, logError } = require("../utils/logger");
const { buildLogContext } = require("../utils/buildLogContext");
const { enqueueSendJob } = require("../queues/sendApplicationQueue");
const { enqueueProcessApplicationJob } = require("../queues/processApplicationQueue");
const { bullmqQueueForJobType } = require("../queues/queueConstants");
const {
  findRecoverableStuckQueuedJobs,
  findRecoverableStuckProcessingJobs,
  createJob,
} = require("../models/applicationJobModel");
const { transitionJobState } = require("../services/transitionJobState");
const { transitionApplicationState } = require("../services/transitionApplicationState");
const { APPLICATION_STATUS } = require("../domain/applicationStatus/constants/uiStatuses");

/**
 * Recovery operates on latest active application_jobs per type — skips needs_review / sent / cancelled.
 */
async function recoverStuckJobs(client) {
  const queued = await findRecoverableStuckQueuedJobs(5, client);
  for (const row of queued) {
    const ctx = buildLogContext({
      applicationId: row.application_id,
      jobId: row.id,
      userId: row.user_id,
      queueName: bullmqQueueForJobType(row.job_type),
      jobType: row.job_type,
    });
    try {
      let enqueueResult;
      if (row.job_type === "send_email") {
        const email = row.contact_email || row.recipient_email;
        if (!email) {
          logInfo("RECOVERY_SKIP_NO_EMAIL", ctx);
          continue;
        }
        enqueueResult = await enqueueSendJob(row.application_id, row.user_id, email, {
          dbJobId: row.id,
        });
      } else if (row.job_type === "ai_process") {
        enqueueResult = await enqueueProcessApplicationJob(row.application_id, row.user_id, {
          dbJobId: row.id,
        });
      }
      logInfo("RECOVERY_REENQUEUED", {
        ...ctx,
        jobType: row.job_type,
        alreadyQueued: Boolean(enqueueResult?.alreadyQueued),
      });
    } catch (err) {
      logError("RECOVERY_REENQUEUE_FAILED", err, ctx);
    }
  }

  const processing = await findRecoverableStuckProcessingJobs(15, client);
  const MAX = parseInt(process.env.MAX_PROCESSING_ATTEMPTS || "5", 10);

  for (const row of processing) {
    const ctx = buildLogContext({
      applicationId: row.application_id,
      jobId: row.id,
      userId: row.user_id,
      queueName: bullmqQueueForJobType(row.job_type),
      jobType: row.job_type,
    });

    if (row.retry_count >= MAX) {
      await transitionJobState(client, {
        jobId: row.id,
        expectedStatus: "processing",
        nextStatus: "failed",
        lastError: "recovery_max_attempts",
      });
      await transitionApplicationState(client, {
        applicationId: row.application_id,
        expectedStatus: [APPLICATION_STATUS.DRAFT, APPLICATION_STATUS.GENERATED],
        nextStatus: APPLICATION_STATUS.FAILED,
        patch: { lastError: "recovery_max_attempts", failureStage: "recovery" },
      });
      logInfo("RECOVERY_JOB_FAILED", ctx);
      continue;
    }

    await transitionJobState(client, {
      jobId: row.id,
      expectedStatus: "processing",
      nextStatus: "retrying",
    });

    const newJob = await createJob(
      {
        applicationId: row.application_id,
        jobType: row.job_type,
        status: "queued",
      },
      client
    );

    if (row.job_type === "send_email") {
      const email = row.contact_email || row.recipient_email;
      if (email) {
        await enqueueSendJob(row.application_id, row.user_id, email, { dbJobId: newJob.id });
      }
    } else {
      await enqueueProcessApplicationJob(row.application_id, row.user_id, { dbJobId: newJob.id });
    }

    logInfo("RECOVERY_PROCESSING_RESET", { ...ctx, newJobId: newJob.id });
  }
}

async function runRecovery() {
  const client = await pool.connect();
  let lockAcquired = false;

  try {
    const { rows } = await client.query("SELECT pg_try_advisory_lock(987654321) AS acquired");
    lockAcquired = rows[0].acquired;
    if (!lockAcquired) {
      logInfo("RECOVERY_LOCK_SKIPPED", { reason: "another instance holds lock" });
      return;
    }

    logInfo("RECOVERY_LOCK_ACQUIRED");
    try {
      const { getAllQueueCounts } = require("../queues/validateQueueSystem");
      const counts = await getAllQueueCounts();
      for (const [queueName, metrics] of Object.entries(counts)) {
        logInfo("RECOVERY_QUEUE_METRICS", { queueName, ...metrics });
      }
    } catch (metricsErr) {
      logError("RECOVERY_QUEUE_METRICS_FAILED", metricsErr);
    }
    await recoverStuckJobs(client);
  } finally {
    if (lockAcquired) {
      await client.query("SELECT pg_advisory_unlock(987654321)");
      logInfo("RECOVERY_LOCK_RELEASED");
    }
    client.release();
  }
}

async function recoveryLoop() {
  logInfo("RECOVERY_LOOP_STARTED");
  try {
    await runRecovery();
    logInfo("RECOVERY_LOOP_COMPLETED");
  } catch (err) {
    logError("RECOVERY_LOOP_ERROR", err);
  }
  setTimeout(recoveryLoop, 5 * 60 * 1000);
}

module.exports = { runRecovery, recoveryLoop };
