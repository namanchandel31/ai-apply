const { Worker } = require("bullmq");
const { getBullmqConnectionOptions } = require("../queues/connection");
const { QUEUE_NAMES } = require("../constants/queues");
const { attachWorkerLifecycle } = require("../queues/workerLifecycle");
const { pool } = require("../db");
const { getApplicationById, updateApplicationFields, transitionApplicationState } = require("../models/applicationModel");
const { getLatestJobByType } = require("../models/applicationJobModel");
const { transitionJobState } = require("../services/transitionJobState");
const { recordEvent } = require("../models/applicationEventModel");
const { updateJobDescriptionFromParsed } = require("../models/jdModel");
const { resolveResumeForAutoApply } = require("../services/resolveResumeForAutoApply");
const { parseJobDescription } = require("../services/jdParseService");
const { classifyJdParseFailure } = require("../services/jdParseFailureClassifier");
const { finalizeBullMqJobFailure, willBullMqRetry } = require("../queues/bullmqJobFailure");
const { inspectBullmqJob } = require("../services/bullmqJobInspector");
const {
  shouldPersistTerminalFailure,
  logFailureDecision,
} = require("../services/failureDecision");
const {
  resolveExecutionState,
  logExecutionTimeline,
  assertExecutionInvariants,
} = require("../services/executionStateResolver");
const { APPLICATION_STATUS } = require("../domain/applicationStatus/constants/uiStatuses");
const { computeMatch } = require("../services/matchingService");
const { generateApplicationEmail } = require("../services/emailService");
const { buildEmailGenerationContext } = require("../services/emailContextBuilder");
const { getEmailPreferenceLevels, getUserApplyMode } = require("../models/userModel");
const { shouldEnqueueSendAfterGeneration } = require("../services/applyModeService");
const { enqueueSendJob } = require("../queues/sendApplicationQueue");
const { createJob } = require("../models/applicationJobModel");
const { logInfo, logError } = require("../utils/logger");
const { buildLogContext } = require("../utils/buildLogContext");
const { safePersistApplicationFailure } = require("../services/safePersistApplicationFailure");
const { runWithTrace } = require("../observability/orchestrationTraceContext");

const REVIEW_REASON = {
  MISSING_CONTACT: "missing_contact_email",
};

async function processor(job) {
  const { applicationId, userId, dbJobId } = job.data;
  return runWithTrace(
    {
      traceId: job.data.traceId || job.id,
      requestId: job.data.requestId || job.id,
      orchestrationId: applicationId,
      jobId: job.id,
      component: "worker",
    },
    async () => processorInner(job, { applicationId, userId, dbJobId })
  );
}

async function processorInner(job, { applicationId, userId, dbJobId }) {
  const reqId = job.id;

  const app = await getApplicationById(applicationId, userId);
  if (!app) {
    logError("process_worker_app_missing", new Error("Application not found"), { applicationId });
    return;
  }

  if (app.application_status !== APPLICATION_STATUS.DRAFT) {
    const bullmq = await inspectBullmqJob(applicationId, "ai_process");
    logInfo("process_worker_skip_terminal", {
      applicationId,
      status: app.application_status,
      bullmqState: bullmq.jobState,
      business_workflow: "skipped",
    });
    logExecutionTimeline("WORKER_SKIP_TERMINAL", {
      applicationId,
      jobId,
      applicationStatus: app.application_status,
      bullmqState: bullmq.jobState,
    });
    return {
      skipped: true,
      skipReason: `application_status_${app.application_status}`,
    };
  }

  const processJobRow = dbJobId
    ? await getLatestJobByType(applicationId, "ai_process")
    : await getLatestJobByType(applicationId, "ai_process");

  const jobId = processJobRow?.id || dbJobId;
  if (!jobId) {
    throw new Error("No ai_process job row");
  }

  const claim = await transitionJobState(pool, {
    jobId,
    expectedStatus: "queued",
    nextStatus: "processing",
  });
  if (!claim.ok) {
    logInfo("process_worker_claim_skipped", { applicationId, jobId, business_workflow: "skipped" });
    return { skipped: true, skipReason: "job_claim_not_queued" };
  }

  logInfo(
    "processing_started",
    buildLogContext({
      applicationId,
      jobId,
      userId,
      reqId,
      workerName: "process-application",
      queueName: QUEUE_NAMES.PROCESS_APPLICATION,
    })
  );
  await recordEvent({
    applicationId,
    eventType: "processing_started",
    actorType: "worker",
    actorId: "process-application",
    metadata: { jobId },
  });

  const { withPgClient, markClientInTransaction } = require("../db/pgClient");

  await withPgClient(pool, async (client) => {
  try {
    const { rows: jdRows } = await client.query(
      `SELECT raw_text FROM job_descriptions WHERE id = $1`,
      [app.job_description_id]
    );
    const rawText = jdRows[0]?.raw_text;
    if (!rawText) throw new Error("Missing job description text");

    const resume = await resolveResumeForAutoApply(userId);
    if (resume.resumeId !== app.resume_id) {
      logInfo("resume_resolved_to_latest", {
        applicationId,
        previousResumeId: app.resume_id,
        resolvedResumeId: resume.resumeId,
      });
    }

    logInfo("ai_generation_started", { applicationId });
    const parsedJd = await parseJobDescription(rawText, userId, {
      reqId,
      resumeSkills: resume.parsedJson?.skills || [],
      jobDescriptionId: app.job_description_id,
    });
    logInfo("ai_generation_completed", {
      applicationId,
      parseOutcome: parsedJd.parseOutcome,
      parseConfidence: parsedJd.parseConfidence,
    });
    const matchResult = computeMatch(resume.parsedJson, parsedJd);
    const jobTitle = (parsedJd.job_title || "").toLowerCase().trim();
    const company = (parsedJd.company_name || "").toLowerCase().trim();
    const contactEmail = parsedJd.contact_email;

    const prefLevels = (await getEmailPreferenceLevels(userId)) || {
      emailToneLevel: 50,
      emailStructureLevel: 60,
    };

    const emailContext = buildEmailGenerationContext({
      rawJdText: rawText,
      parsedJd,
      resumeParsedJson: resume.parsedJson,
      matchResult,
      emailToneLevel: prefLevels.emailToneLevel,
      emailStructureLevel: prefLevels.emailStructureLevel,
    });

    let cachedEmail;
    if (app.email_subject && app.email_body) {
      cachedEmail = {
        subject: app.email_subject,
        body: app.email_body,
        emailMetadata: app.email_metadata ?? null,
        emailFeedbackSignals: app.email_feedback_signals ?? null,
      };
      logInfo("email_generation_skipped_user_draft", { applicationId });
    } else {
      cachedEmail = await generateApplicationEmail(emailContext, {
        reqId,
        userId,
        resumeId: resume.resumeId,
        jobDescriptionId: app.job_description_id,
      });
    }

    await client.query("BEGIN");
    markClientInTransaction(client);

    await updateJobDescriptionFromParsed(client, app.job_description_id, parsedJd, userId);

    await updateApplicationFields(
      applicationId,
      {
        resume_id: resume.resumeId,
        resume_snapshot_path: resume.filePath,
        email_subject: cachedEmail.subject,
        email_body: cachedEmail.body,
        match_score: matchResult.score,
        recipient_email: contactEmail || null,
        normalized_job_title: jobTitle,
        normalized_company_name: company,
        parsed_jd_snapshot: {
          job_title: parsedJd.job_title,
          company_name: parsedJd.company_name,
          contact_email: parsedJd.contact_email,
          parseOutcome: parsedJd.parseOutcome,
          parseConfidence: parsedJd.parseConfidence,
          roles: parsedJd.roles,
        },
        parsed_resume_snapshot: {
          name: resume.parsedJson?.name,
          skills: (resume.parsedJson?.skills || []).slice(0, 20),
        },
        match_score_snapshot: matchResult.score,
        email_metadata: cachedEmail.emailMetadata,
        email_feedback_signals: cachedEmail.emailFeedbackSignals,
        email_preferences_snapshot: emailContext.generationSnapshot,
      },
      userId,
      client
    );

    await transitionJobState(client, {
      jobId,
      expectedStatus: "processing",
      nextStatus: "completed",
    });

    if (!contactEmail) {
      const tr = await transitionApplicationState(client, {
        applicationId,
        userId,
        expectedStatus: APPLICATION_STATUS.DRAFT,
        nextStatus: APPLICATION_STATUS.NEEDS_REVIEW,
        reviewReason: REVIEW_REASON.MISSING_CONTACT,
      });
      if (!tr.ok) throw new Error("Failed to transition to needs_review");

      await recordEvent(
        {
          applicationId,
          eventType: "needs_review_triggered",
          actorType: "worker",
          actorId: "process-application",
          metadata: { reviewReason: REVIEW_REASON.MISSING_CONTACT },
        },
        client
      );

      await client.query("COMMIT");
      const { flushRealtimeAfterDbCommit } = require("../realtime/postCommitFlush");
      await flushRealtimeAfterDbCommit([applicationId]);
      return;
    }

    const genTr = await transitionApplicationState(client, {
      applicationId,
      userId,
      expectedStatus: APPLICATION_STATUS.DRAFT,
      nextStatus: APPLICATION_STATUS.GENERATED,
      clearReviewReason: true,
    });
    if (!genTr.ok) throw new Error("Failed to transition to generated");

    const applyMode = await getUserApplyMode(userId, client);
    if (!shouldEnqueueSendAfterGeneration(applyMode)) {
      await recordEvent(
        {
          applicationId,
          eventType: "ready_for_review",
          actorType: "worker",
          actorId: "process-application",
          metadata: { applyMode },
        },
        client
      );
      await client.query("COMMIT");
      const { flushRealtimeAfterDbCommit } = require("../realtime/postCommitFlush");
      await flushRealtimeAfterDbCommit([applicationId]);
      return;
    }

    const sendDbJob = await createJob(
      { applicationId, jobType: "send_email", status: "queued" },
      client
    );

    await client.query("COMMIT");
    const { flushRealtimeAfterDbCommit } = require("../realtime/postCommitFlush");
    await flushRealtimeAfterDbCommit([applicationId]);

    await enqueueSendJob(applicationId, userId, contactEmail, { dbJobId: sendDbJob.id });

    await recordEvent({
      applicationId,
      eventType: "process_job_queued",
      actorType: "worker",
      actorId: "send",
      metadata: { sendJobId: sendDbJob.id },
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});

    logError(
      "PROCESS_APPLICATION_FAILED",
      err,
      buildLogContext({
        applicationId,
        jobId,
        userId,
        reqId,
        workerName: "process-application",
        queueName: QUEUE_NAMES.PROCESS_APPLICATION,
        attempt: job.attemptsMade,
      })
    );

    const bullmq = await inspectBullmqJob(applicationId, "ai_process");
    const willRetry = willBullMqRetry(job, err);
    const willPersist = shouldPersistTerminalFailure(job, err, bullmq);
    const maxAttempts = job.opts?.attempts ?? 3;

    logFailureDecision({
      applicationId,
      jobId,
      failureReason: err.message,
      failureSource: "process-application.worker",
      bullmqState: bullmq.jobState,
      workerState: "catch",
      retryBudget: { attemptsMade: job.attemptsMade, maxAttempts },
      willPersist,
      willRetry,
      err,
    });

    const resolved = await resolveExecutionState(applicationId, userId, {
      jobType: "ai_process",
      bullmqJob: job,
      err,
    });
    assertExecutionInvariants(resolved, { source: "process_worker_catch" });

    logExecutionTimeline(willPersist ? "APPLICATION_FAILED" : willRetry ? "JOB_RETRIED" : "JOB_FAILED", {
      applicationId,
      jobId,
      bullmqJobId: job.id,
      attemptsMade: job.attemptsMade,
      willPersist,
      willRetry,
    });

    if (willPersist) {
      await safePersistApplicationFailure(pool, {
        applicationId,
        userId,
        jobId,
        failureStage: err.stage || "ai_process",
        lastError: err.message,
        expectedAppStatuses: [APPLICATION_STATUS.DRAFT],
        failureSource: "process-application.worker",
        bullmqState: bullmq.jobState,
        retryBudget: { attemptsMade: job.attemptsMade, maxAttempts },
      });
      await recordEvent({
        applicationId,
        eventType: "processing_failed",
        actorType: "worker",
        actorId: "process-application",
        metadata: {
          message: err.message,
          error_type: err?.name,
          retryable: false,
          terminal: true,
          validation: err?.validation || null,
          parseOutcome: err?.parseOutcome || null,
        },
      });
    } else {
      await recordEvent({
        applicationId,
        eventType: willRetry ? "processing_retry_scheduled" : "processing_failed",
        actorType: "worker",
        actorId: "process-application",
        metadata: {
          message: err.message,
          error_type: err?.name,
          retryable: willRetry,
          terminal: false,
          attemptsMade: job.attemptsMade,
        },
      });
    }

    const action = classifyJdParseFailure(err, {
      isApplyEligible: err?.isApplyEligible,
      parseOutcome: err?.parseOutcome,
    });

    await finalizeBullMqJobFailure(job, err, {
      forceUnrecoverable: action === "unrecoverable" || willPersist,
    });
  }
  });
}

const bullmqConnection = getBullmqConnectionOptions();

const worker = new Worker(QUEUE_NAMES.PROCESS_APPLICATION, processor, {
  connection: bullmqConnection,
  concurrency: require("../config").queue.WORKER_CONCURRENCY.process,
});

attachWorkerLifecycle(worker, {
  workerName: "process-application",
  queueName: QUEUE_NAMES.PROCESS_APPLICATION,
});

module.exports = {
  worker,
  QUEUE_NAME: QUEUE_NAMES.PROCESS_APPLICATION,
  processor,
};
