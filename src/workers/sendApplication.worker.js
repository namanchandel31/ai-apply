const { Worker, UnrecoverableError } = require("bullmq");
const { pool } = require("../db");
const nodemailer = require("nodemailer");
const { getBullmqConnectionOptions } = require("../queues/connection");
const { logBullmqComponentBinding } = require("../observability/redisDebugInstrumentation");
const { QUEUE_NAMES } = require("../constants/queues");
const { attachWorkerLifecycle } = require("../queues/workerLifecycle");
const {
  getApplicationById,
  markSentFromGenerated,
} = require("../models/applicationModel");
const {
  getLatestJobByType,
  hasCompletedSendJob,
  hasActiveJob,
} = require("../models/applicationJobModel");
const { transitionJobState } = require("../services/transitionJobState");
const { recordEvent } = require("../models/applicationEventModel");
const { fetchSmtpCredentials } = require("../services/mailService");
const { supabase } = require("../config/supabase");
const { APPLICATION_STATUS } = require("../domain/applicationStatus/constants/uiStatuses");
const { logInfo, logError } = require("../utils/logger");
const { buildLogContext } = require("../utils/buildLogContext");
const { safePersistApplicationFailure } = require("../services/safePersistApplicationFailure");
const {
  finalizeBullMqJobFailure,
  willBullMqRetry,
  isSmtpAuthFailure,
} = require("../queues/bullmqJobFailure");
const { NonRetryableError } = require("../utils/errors");
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
const { resolveResumeForAutoApply } = require("../services/resolveResumeForAutoApply");

const processor = async (job) => {
  const { applicationId, userId, recipientEmail, dbJobId } = job.data;
  const reqId = job.id;

  // #region agent log
  fetch('http://127.0.0.1:7450/ingest/4705d152-a121-4937-9af9-91260b409138',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'89dbee'},body:JSON.stringify({sessionId:'89dbee',location:'sendApplication.worker.js:processor_entry',message:'send job received',data:{applicationId,userId,attempt:job.attemptsMade,recipientDomain:recipientEmail?.split('@')[1]||null},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  const application = await getApplicationById(applicationId, userId);
  if (!application) {
    throw new UnrecoverableError(`Application not found: ${applicationId}`);
  }

  if (application.application_status === APPLICATION_STATUS.SENT) {
    logInfo("send_worker_already_sent", { applicationId });
    return;
  }

  if (application.application_status === APPLICATION_STATUS.CANCELLED) {
    throw new UnrecoverableError("Application cancelled");
  }

  if (application.application_status === APPLICATION_STATUS.NEEDS_REVIEW) {
    throw new UnrecoverableError("Application needs review");
  }

  if (await hasCompletedSendJob(applicationId)) {
    logInfo("send_worker_duplicate_prevented", { applicationId });
    return;
  }

  const sendJobRow = await getLatestJobByType(applicationId, "send_email");
  const jobRowId = sendJobRow?.id || dbJobId;
  if (!jobRowId) {
    throw new UnrecoverableError("No send_email job row");
  }

  const claim = await transitionJobState(pool, {
    jobId: jobRowId,
    expectedStatus: "queued",
    nextStatus: "processing",
  });
  if (!claim.ok) {
    // #region agent log
    fetch('http://127.0.0.1:7450/ingest/4705d152-a121-4937-9af9-91260b409138',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'89dbee'},body:JSON.stringify({sessionId:'89dbee',location:'sendApplication.worker.js:claim_skipped',message:'job claim skipped',data:{applicationId,jobRowId},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    logInfo("send_worker_claim_skipped", { applicationId });
    return;
  }

  logInfo(
    "send_started",
    buildLogContext({
      applicationId,
      jobId: jobRowId,
      userId,
      reqId,
      workerName: "send-application",
      queueName: QUEUE_NAMES.SEND_APPLICATION,
    })
  );
  await recordEvent({
    applicationId,
    eventType: "send_started",
    actorType: "worker",
    actorId: "send-application",
    metadata: { jobRowId },
  });

  try {
    if (application.application_status !== APPLICATION_STATUS.GENERATED) {
      throw new UnrecoverableError(
        `Invalid application status for send: ${application.application_status}`
      );
    }

    const credentials = await fetchSmtpCredentials(userId);

    // #region agent log
    fetch('http://127.0.0.1:7450/ingest/4705d152-a121-4937-9af9-91260b409138',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'89dbee'},body:JSON.stringify({sessionId:'89dbee',location:'sendApplication.worker.js:credentials_loaded',message:'smtp credentials fetched',data:{applicationId,credentialEmailDomain:credentials.email?.split('@')[1]||null,passwordLen:credentials.password?.length||0,appStatus:application.application_status},timestamp:Date.now(),hypothesisId:'A,B'})}).catch(()=>{});
    // #endregion

    const resolvedResume = await resolveResumeForAutoApply(userId);
    const resumeStoragePath =
      resolvedResume.filePath || application.resume_snapshot_path || application.file_path;

    if (!resumeStoragePath) {
      throw new UnrecoverableError("Resume file path missing for send");
    }

    if (resolvedResume.filePath && resolvedResume.filePath !== application.resume_snapshot_path) {
      logInfo("send_resume_path_refreshed", {
        applicationId,
        previousPath: application.resume_snapshot_path,
        resolvedPath: resolvedResume.filePath,
        resolvedResumeId: resolvedResume.resumeId,
      });
    }

    let fileBuffer;
    const { data, error } = await supabase.storage
      .from("resumes")
      .download(resumeStoragePath);

    if (error) {
      const isPermanent =
        error.status === 404 || error.message?.includes("not found");
      if (isPermanent) {
        throw new UnrecoverableError(`Resume not found: ${resumeStoragePath}`);
      }
      throw new Error(`Storage error: ${error.message}`);
    }
    const arrayBuffer = await data.arrayBuffer();
    fileBuffer = Buffer.from(arrayBuffer);

    // #region agent log
    fetch('http://127.0.0.1:7450/ingest/4705d152-a121-4937-9af9-91260b409138',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'89dbee'},body:JSON.stringify({sessionId:'89dbee',location:'sendApplication.worker.js:resume_ready',message:'resume downloaded, attempting smtp send',data:{applicationId,resumeBytes:fileBuffer?.length||0,hasSubject:!!application.email_subject,hasBody:!!application.email_body},timestamp:Date.now(),hypothesisId:'E'})}).catch(()=>{});
    // #endregion

    const { createTransportOptions } = require("../config/mail.config");
    const transporter = nodemailer.createTransport(
      createTransportOptions({ user: credentials.email, pass: credentials.password })
    );

    const smtpResult = await transporter.sendMail({
      from: credentials.email,
      to: recipientEmail,
      subject: application.email_subject,
      text: application.email_body,
      attachments: [
        { filename: "resume.pdf", content: fileBuffer, contentType: "application/pdf" },
      ],
    });

    const sentRow = await markSentFromGenerated(applicationId, userId, smtpResult.messageId, pool);
    if (!sentRow) {
      const current = await getApplicationById(applicationId, userId);
      if (current?.application_status !== APPLICATION_STATUS.SENT) {
        throw new Error("CAS sent transition failed");
      }
    }

    await transitionJobState(pool, {
      jobId: jobRowId,
      expectedStatus: "processing",
      nextStatus: "completed",
    });

    logInfo("application_sent", { reqId, applicationId, messageId: smtpResult.messageId });
    await recordEvent({
      applicationId,
      eventType: "email_sent",
      actorType: "worker",
      actorId: "send-application",
      metadata: { messageId: smtpResult.messageId },
    });
  } catch (rawErr) {
    let err = rawErr;
    if (isSmtpAuthFailure(rawErr)) {
      err = Object.assign(
        new NonRetryableError(
          "Gmail rejected your app password — reconnect in Email Configuration with a new 16-character app password"
        ),
        { stage: "smtp", cause: rawErr }
      );
    }

    // #region agent log
    fetch('http://127.0.0.1:7450/ingest/4705d152-a121-4937-9af9-91260b409138',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'89dbee'},body:JSON.stringify({sessionId:'89dbee',location:'sendApplication.worker.js:send_failed',message:'send worker catch',data:{applicationId,errorMessage:err?.message?.slice(0,120),attempt:job.attemptsMade,isBadCredentials:isSmtpAuthFailure(rawErr),isUnrecoverable:err instanceof UnrecoverableError},timestamp:Date.now(),hypothesisId:'A,D',runId:'post-fix'})}).catch(()=>{});
    // #endregion
    logError(
      "SEND_APPLICATION_FAILED",
      err,
      buildLogContext({
        applicationId,
        jobId: jobRowId,
        userId,
        reqId,
        workerName: "send-application",
        queueName: QUEUE_NAMES.SEND_APPLICATION,
        attempt: job.attemptsMade,
      })
    );

    const bullmq = await inspectBullmqJob(applicationId, "send_email");
    const willRetry = willBullMqRetry(job, err);
    const willPersist = shouldPersistTerminalFailure(job, err, bullmq);
    const maxAttempts = job.opts?.attempts ?? 5;

    logFailureDecision({
      applicationId,
      jobId: jobRowId,
      failureReason: err.message,
      failureSource: "send-application.worker",
      bullmqState: bullmq.jobState,
      workerState: "catch",
      retryBudget: { attemptsMade: job.attemptsMade, maxAttempts },
      willPersist,
      willRetry,
      err,
    });

    const resolved = await resolveExecutionState(applicationId, userId, {
      jobType: "send_email",
      bullmqJob: job,
      err,
    });
    assertExecutionInvariants(resolved, { source: "send_worker_catch" });

    logExecutionTimeline(willPersist ? "APPLICATION_FAILED" : willRetry ? "JOB_RETRIED" : "JOB_FAILED", {
      applicationId,
      jobId: jobRowId,
      willPersist,
      willRetry,
    });

    if (willPersist) {
      await safePersistApplicationFailure(pool, {
        applicationId,
        userId,
        jobId: jobRowId,
        failureStage: err.stage || "smtp_send",
        lastError: err.message,
        expectedAppStatuses: [APPLICATION_STATUS.DRAFT, APPLICATION_STATUS.GENERATED],
        failureSource: "send-application.worker",
        bullmqState: bullmq.jobState,
        retryBudget: { attemptsMade: job.attemptsMade, maxAttempts },
      });
      await recordEvent({
        applicationId,
        eventType: "send_failed",
        actorType: "worker",
        actorId: "send-application",
        metadata: { message: err.message, terminal: true, retryable: false },
      });
    } else if (willRetry) {
      await transitionJobState(pool, {
        jobId: jobRowId,
        expectedStatus: "processing",
        nextStatus: "queued",
        lastError: err.message,
        patch: { retryCountIncrement: true },
      });
      await recordEvent({
        applicationId,
        eventType: "send_retry_scheduled",
        actorType: "worker",
        actorId: "send-application",
        metadata: { message: err.message, terminal: false, retryable: true },
      });
    } else {
      await recordEvent({
        applicationId,
        eventType: "send_failed",
        actorType: "worker",
        actorId: "send-application",
        metadata: { message: err.message, terminal: false, retryable: false },
      });
    }

    await finalizeBullMqJobFailure(job, err, {
      forceUnrecoverable: err instanceof UnrecoverableError || willPersist,
    });
  }
};

const bullmqConnection = getBullmqConnectionOptions();

logBullmqComponentBinding({
  componentType: "worker",
  componentName: QUEUE_NAMES.SEND_APPLICATION,
  connection: null,
  hypothesisId: "A",
  extra: { blocking: true, dedicatedConnection: true },
});

const worker = new Worker(QUEUE_NAMES.SEND_APPLICATION, processor, {
  connection: bullmqConnection,
  concurrency: require("../config").queue.WORKER_CONCURRENCY.send,
});

attachWorkerLifecycle(worker, {
  workerName: "send-application",
  queueName: QUEUE_NAMES.SEND_APPLICATION,
});

module.exports = {
  worker,
  QUEUE_NAME: QUEUE_NAMES.SEND_APPLICATION,
  processor,
};
