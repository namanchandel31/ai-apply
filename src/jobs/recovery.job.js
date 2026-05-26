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
const {
  inspectBullmqJob,
  bullmqIsTerminalFailure,
  maxAttemptsForJobType,
} = require("../services/bullmqJobInspector");
const {
  resolveExecutionState,
  assertExecutionInvariants,
} = require("../services/executionStateResolver");
const { logFailureDecision } = require("../services/failureDecision");

function logRecoveryDecision(ctx, decision) {
  logInfo("RECOVERY_DECISION", {
    ...ctx,
    ...decision,
  });
}

/**
 * Recovery operates on latest active application_jobs per type — skips needs_review / sent / cancelled.
 * BullMQ is execution truth; DB-only signals never alone cause terminal failure.
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

    const bullmq = await inspectBullmqJob(row.application_id, row.job_type);
    const resolved = await resolveExecutionState(row.application_id, row.user_id, {
      jobType: row.job_type,
    });
    assertExecutionInvariants(resolved, { source: "recovery_queued" });

    const decision = {
      jobExists: bullmq.jobExists,
      jobState: bullmq.jobState,
      applicationStatus: row.application_status,
      retryCount: row.retry_count,
      bullmqAttemptsMade: bullmq.attemptsMade,
      willReenqueue: false,
      willFail: false,
      reason: null,
    };

    if (bullmq.jobExists && ["waiting", "delayed", "active"].includes(bullmq.jobState)) {
      decision.reason = "bullmq_already_in_flight";
      logRecoveryDecision(ctx, decision);
      continue;
    }

    if (bullmq.jobExists && bullmq.jobState === "completed") {
      if (["queued", "processing", "retrying"].includes(row.status)) {
        const sync = await transitionJobState(client, {
          jobId: row.id,
          expectedStatus: ["queued", "processing", "retrying"],
          nextStatus: "completed",
          lastError: null,
        });
        decision.reason = sync.ok
          ? "reconciled_db_job_to_match_bullmq_completed"
          : "bullmq_completed_db_sync_skipped";
        logRecoveryDecision(ctx, decision);
        logInfo("RECOVERY_RECONCILED_EXECUTION", {
          ...ctx,
          dbJobSynced: sync.ok,
          applicationStatus: row.application_status,
        });
      } else {
        decision.reason = "bullmq_already_completed";
        logRecoveryDecision(ctx, decision);
      }
      continue;
    }

    if (resolved.applicationIsTerminal) {
      decision.reason = "application_already_terminal";
      logRecoveryDecision(ctx, decision);
      continue;
    }

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
      decision.willReenqueue = true;
      decision.reason = enqueueResult?.alreadyQueued ? "already_queued_idempotent" : "reenqueued";
      logRecoveryDecision(ctx, decision);
      logInfo("RECOVERY_REENQUEUED", {
        ...ctx,
        jobType: row.job_type,
        alreadyQueued: Boolean(enqueueResult?.alreadyQueued),
        bullmqState: bullmq.jobState,
      });
    } catch (err) {
      logError("RECOVERY_REENQUEUE_FAILED", err, ctx);
    }
  }

  const processing = await findRecoverableStuckProcessingJobs(15, client);

  for (const row of processing) {
    const ctx = buildLogContext({
      applicationId: row.application_id,
      jobId: row.id,
      userId: row.user_id,
      queueName: bullmqQueueForJobType(row.job_type),
      jobType: row.job_type,
    });

    const bullmq = await inspectBullmqJob(row.application_id, row.job_type);
    const maxAttempts = maxAttemptsForJobType(row.job_type);
    const resolved = await resolveExecutionState(row.application_id, row.user_id, {
      jobType: row.job_type,
    });
    assertExecutionInvariants(resolved, { source: "recovery_processing" });

    const decision = {
      jobExists: bullmq.jobExists,
      jobState: bullmq.jobState,
      applicationStatus: row.application_status,
      retryCount: row.retry_count,
      bullmqAttemptsMade: bullmq.attemptsMade,
      maxAttempts,
      willReenqueue: false,
      willFail: false,
      reason: null,
    };

    if (bullmq.jobExists && ["waiting", "delayed", "active"].includes(bullmq.jobState)) {
      decision.reason = "bullmq_still_executing";
      logRecoveryDecision(ctx, decision);
      continue;
    }

    if (resolved.applicationIsTerminal) {
      decision.reason = "application_already_terminal";
      logRecoveryDecision(ctx, decision);
      continue;
    }

    const bullmqTerminal = bullmqIsTerminalFailure(bullmq);
    const dbRetryExhausted = (row.retry_count ?? 0) >= maxAttempts;

    if (bullmqTerminal || (bullmq.jobExists && bullmq.jobState === "failed" && bullmqTerminal)) {
      decision.willFail = true;
      decision.reason = "bullmq_retries_exhausted";
      logRecoveryDecision(ctx, decision);

      logFailureDecision({
        applicationId: row.application_id,
        jobId: row.id,
        failureReason: "bullmq_retries_exhausted",
        failureSource: "recovery",
        bullmqState: bullmq.jobState,
        workerState: row.status,
        retryBudget: { made: bullmq.attemptsMade, max: maxAttempts },
        willPersist: true,
        willRetry: false,
      });

      await transitionJobState(client, {
        jobId: row.id,
        expectedStatus: "processing",
        nextStatus: "failed",
        lastError: "recovery_bullmq_exhausted",
      });
      await transitionApplicationState(client, {
        applicationId: row.application_id,
        expectedStatus: [APPLICATION_STATUS.DRAFT, APPLICATION_STATUS.GENERATED],
        nextStatus: APPLICATION_STATUS.FAILED,
        patch: { lastError: "recovery_bullmq_exhausted", failureStage: "recovery" },
      });
      logInfo("RECOVERY_JOB_FAILED", { ...ctx, reason: decision.reason });
      continue;
    }

    if (!bullmq.jobExists && dbRetryExhausted) {
      decision.willFail = true;
      decision.reason = "orphan_processing_db_retries_exhausted";
      logRecoveryDecision(ctx, decision);

      await transitionJobState(client, {
        jobId: row.id,
        expectedStatus: "processing",
        nextStatus: "failed",
        lastError: "recovery_orphan_exhausted",
      });
      await transitionApplicationState(client, {
        applicationId: row.application_id,
        expectedStatus: [APPLICATION_STATUS.DRAFT, APPLICATION_STATUS.GENERATED],
        nextStatus: APPLICATION_STATUS.FAILED,
        patch: { lastError: "recovery_orphan_exhausted", failureStage: "recovery" },
      });
      logInfo("RECOVERY_JOB_FAILED", { ...ctx, reason: decision.reason });
      continue;
    }

    if (bullmq.jobExists && bullmq.jobState === "failed" && !bullmqTerminal) {
      decision.reason = "bullmq_failed_retry_pending";
      logRecoveryDecision(ctx, decision);
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

    decision.willReenqueue = true;
    decision.reason = "processing_reset_reenqueue";
    logRecoveryDecision(ctx, decision);
    logInfo("RECOVERY_PROCESSING_RESET", { ...ctx, newJobId: newJob.id, bullmqState: bullmq.jobState });
  }
}

async function runRecovery() {
  const { withPgClient } = require("../db/pgClient");
  await withPgClient(pool, async (client) => {
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
    }
  });
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
