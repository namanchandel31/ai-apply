const { Worker } = require("bullmq");
const { connection } = require("../queues/connection");
const { QUEUE_NAME } = require("../queues/processApplicationQueue");
const { attachWorkerLifecycle } = require("../queues/workerLifecycle");
const { pool } = require("../db");
const { getApplicationById, updateApplicationFields, transitionApplicationState } = require("../models/applicationModel");
const { getLatestJobByType } = require("../models/applicationJobModel");
const { transitionJobState } = require("../services/transitionJobState");
const { recordEvent } = require("../models/applicationEventModel");
const { updateJobDescriptionFromParsed } = require("../models/jdModel");
const { getResumeById } = require("../models/resumeModel");
const { parseJobDescription } = require("../services/jdParseService");
const { computeMatch } = require("../services/matchingService");
const { generateApplicationEmail } = require("../services/emailService");
const { enqueueSendJob } = require("../queues/sendApplicationQueue");
const { createJob } = require("../models/applicationJobModel");
const { APPLICATION_STATUS } = require("../domain/applicationStatus/constants/uiStatuses");
const { logInfo, logError } = require("../utils/logger");
const { buildLogContext } = require("../utils/buildLogContext");
const { safePersistApplicationFailure } = require("../services/safePersistApplicationFailure");

const REVIEW_REASON = {
  MISSING_CONTACT: "missing_contact_email",
};

async function processor(job) {
  const { applicationId, userId, dbJobId } = job.data;
  const reqId = job.id;

  const app = await getApplicationById(applicationId, userId);
  if (!app) {
    logError("process_worker_app_missing", new Error("Application not found"), { applicationId });
    return;
  }

  if (app.application_status !== APPLICATION_STATUS.DRAFT) {
    logInfo("process_worker_skip", { applicationId, status: app.application_status });
    return;
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
    logInfo("process_worker_claim_skipped", { applicationId, jobId });
    return;
  }

  logInfo(
    "processing_started",
    buildLogContext({
      applicationId,
      jobId,
      userId,
      reqId,
      workerName: "process-application",
      queueName: QUEUE_NAME,
    })
  );
  await recordEvent({
    applicationId,
    eventType: "processing_started",
    actorType: "worker",
    actorId: "process-application",
    metadata: { jobId },
  });

  const client = await pool.connect();

  try {
    const { rows: jdRows } = await client.query(
      `SELECT raw_text FROM job_descriptions WHERE id = $1`,
      [app.job_description_id]
    );
    const rawText = jdRows[0]?.raw_text;
    if (!rawText) throw new Error("Missing job description text");

    logInfo("ai_generation_started", { applicationId });
    const parsedJd = await parseJobDescription(rawText, userId, { reqId });
    logInfo("ai_generation_completed", { applicationId });

    const resume = await getResumeById(app.resume_id, userId);
    const matchResult = computeMatch(resume.parsedJson, parsedJd);
    const jobTitle = (parsedJd.job_title || "").toLowerCase().trim();
    const company = (parsedJd.company_name || "").toLowerCase().trim();
    const contactEmail = parsedJd.contact_email;

    const cachedEmail = await generateApplicationEmail(
      resume.parsedJson?.name,
      jobTitle,
      matchResult.matchedSkills,
      matchResult.score,
      { reqId, userId, resumeId: app.resume_id, jobDescriptionId: app.job_description_id }
    );

    await client.query("BEGIN");

    await updateJobDescriptionFromParsed(client, app.job_description_id, parsedJd, userId);

    await updateApplicationFields(
      applicationId,
      {
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
        },
        parsed_resume_snapshot: {
          name: resume.parsedJson?.name,
          skills: (resume.parsedJson?.skills || []).slice(0, 20),
        },
        match_score_snapshot: matchResult.score,
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

    const sendDbJob = await createJob(
      { applicationId, jobType: "send_email", status: "queued" },
      client
    );

    await client.query("COMMIT");

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
        queueName: QUEUE_NAME,
        attempt: job.attemptsMade,
      })
    );

    await safePersistApplicationFailure(pool, {
      applicationId,
      userId,
      jobId,
      failureStage: err.stage || "ai_process",
      lastError: err.message,
      expectedAppStatuses: [APPLICATION_STATUS.DRAFT],
    });
    await recordEvent({
      applicationId,
      eventType: "processing_failed",
      actorType: "worker",
      actorId: "process-application",
      metadata: { message: err.message },
    });

    if (job.attemptsMade + 1 >= (job.opts?.attempts || 3)) {
      logInfo("job_max_attempts_exceeded", { applicationId, jobId, jobType: "ai_process" });
    }

    throw err;
  } finally {
    client.release();
  }
}

const worker = new Worker(QUEUE_NAME, processor, {
  connection,
  concurrency: parseInt(process.env.PROCESS_WORKER_CONCURRENCY || "2", 10),
});

attachWorkerLifecycle(worker, {
  workerName: "process-application",
  queueName: QUEUE_NAME,
});

module.exports = { worker, QUEUE_NAME, processor };
