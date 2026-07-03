const { pool } = require("../db");
const { withPgTransaction } = require("../db/pgClient");
const {
  getApplicationById,
  transitionApplicationState,
  updateApplicationFields,
} = require("../models/applicationModel");
const {
  createJob,
  hasActiveJob,
  hasCompletedSendJob,
  getLatestJobByType,
} = require("../models/applicationJobModel");
const { recordEvent } = require("../models/applicationEventModel");
const { requestApplicationSend } = require("./sendDispatchService");
const intelligentSendQueueService = require("./intelligentSendQueueService");
const { enqueueProcessApplicationJob } = require("../queues/processApplicationQueue");
const { APPLICATION_STATUS } = require("../domain/applicationStatus/constants/uiStatuses");
const { logInfo } = require("../utils/logger");
const { buildLogContext } = require("../utils/buildLogContext");
const {
  scheduleRevivePublish,
  clearPublishCache,
} = require("./applicationRealtimePublisher");

const continueDedup = new Map();

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

async function assertNoActiveExecution(applicationId) {
  if (await hasActiveJob(applicationId, "ai_process")) {
    const err = new Error("A retry is already in progress");
    err.code = "RETRY_ALREADY_IN_FLIGHT";
    throw err;
  }
  if (await hasActiveJob(applicationId, "send_email")) {
    const err = new Error("A retry is already in progress");
    err.code = "RETRY_ALREADY_IN_FLIGHT";
    throw err;
  }
}

async function continueApplication(userId, applicationId, contactEmail, reqId, idempotencyKey) {
  const dedupKey = idempotencyKey || `continue:${applicationId}`;
  const now = Date.now();
  const prev = continueDedup.get(dedupKey);
  if (prev && now - prev < 60_000) {
    const err = new Error("Duplicate continue request");
    err.code = "DUPLICATE_CONTINUE";
    throw err;
  }
  continueDedup.set(dedupKey, now);

  if (!validateEmail(contactEmail)) {
    const err = new Error("Invalid contact email format");
    err.code = "INVALID_EMAIL";
    throw err;
  }

  const app = await getApplicationById(applicationId, userId);
  if (!app) {
    const err = new Error("Application not found");
    err.code = "NOT_FOUND";
    throw err;
  }

  if (app.application_status === APPLICATION_STATUS.SENT) {
    const err = new Error("Application already sent");
    err.code = "ALREADY_SENT";
    throw err;
  }

  if (app.application_status === APPLICATION_STATUS.CANCELLED) {
    const err = new Error("Application cancelled");
    err.code = "INVALID_STATE";
    throw err;
  }

  if (app.application_status !== APPLICATION_STATUS.NEEDS_REVIEW || !app.review_reason) {
    const err = new Error("Application is not awaiting review");
    err.code = "INVALID_STATE";
    throw err;
  }

  if (await hasActiveJob(applicationId, "send_email")) {
    const err = new Error("Send already in progress");
    err.code = "SEND_ALREADY_IN_FLIGHT";
    throw err;
  }

  if (await hasCompletedSendJob(applicationId)) {
    const err = new Error("Application already sent");
    err.code = "ALREADY_SENT";
    throw err;
  }

  const txnResult = await withPgTransaction(pool, async (client) => {
    clearPublishCache(applicationId);

    await client.query(
      `UPDATE job_descriptions SET contact_email = $2 WHERE id = $1`,
      [app.job_description_id, contactEmail.trim().toLowerCase()]
    );

    const tr = await transitionApplicationState(client, {
      applicationId,
      userId,
      expectedStatus: APPLICATION_STATUS.NEEDS_REVIEW,
      nextStatus: APPLICATION_STATUS.GENERATED,
      clearReviewReason: true,
      orchestrationBump: "revive_with_transition",
    });

    if (!tr.ok) {
      const err = new Error("State transition conflict");
      err.code = "STATE_TRANSITION_CONFLICT";
      throw err;
    }

    await client.query(
      `UPDATE applications SET recipient_email = $2 WHERE id = $1`,
      [applicationId, contactEmail.trim().toLowerCase()]
    );

    const previousJob = await getLatestJobByType(applicationId, "send_email", client);

    await recordEvent(
      {
        applicationId,
        eventType: "continue_requested",
        actorType: "user",
        actorId: String(userId),
        metadata: {
          reqId,
          contactEmail,
          retrySource: "user",
          previousJobId: previousJob?.id ?? null,
          attemptNumber: (app.retry_count ?? 0) + 1,
        },
      },
      client
    );

    return { tr };
  });

  const { flushRealtimeAfterDbCommit } = require("../realtime/postCommitFlush");
  await flushRealtimeAfterDbCommit([applicationId]);

  const sendResult = await requestApplicationSend({
    applicationId,
    userId,
    recipientEmail: contactEmail.trim().toLowerCase(),
  });

  logInfo("continue_enqueued", buildLogContext({ applicationId, userId, reqId, sendResult }));

  return {
    applicationId,
    status: APPLICATION_STATUS.GENERATED,
    jobId: sendResult.dbJobId ?? null,
    orchestrationEpoch: Number(txnResult.tr.orchestrationMeta?.orchestration_epoch ?? 0),
    version: Number(txnResult.tr.orchestrationMeta?.orchestration_version ?? 0),
  };
}

async function retryApplication(userId, applicationId, reqId) {
  const app = await getApplicationById(applicationId, userId);
  if (!app) {
    const err = new Error("Application not found");
    err.code = "NOT_FOUND";
    throw err;
  }

  if ([APPLICATION_STATUS.SENT, APPLICATION_STATUS.CANCELLED, APPLICATION_STATUS.NEEDS_REVIEW].includes(
    app.application_status
  )) {
    const err = new Error("Cannot retry this application");
    err.code = "INVALID_STATE";
    throw err;
  }

  if (app.review_reason) {
    const err = new Error("Application needs review");
    err.code = "INVALID_STATE";
    throw err;
  }

  await assertNoActiveExecution(applicationId);

  clearPublishCache(applicationId);

  const previousProcessJob = await getLatestJobByType(applicationId, "ai_process");
  const previousSendJob = await getLatestJobByType(applicationId, "send_email");
  const previousJobId = previousProcessJob?.id || previousSendJob?.id || null;
  const attemptNumber = (app.retry_count ?? 0) + 1;

  await pool.query(
    `UPDATE applications SET retry_count = retry_count + 1, last_retry_at = NOW() WHERE id = $1`,
    [applicationId]
  );

  await recordEvent({
    applicationId,
    eventType: "retry_requested",
    actorType: "user",
    actorId: String(userId),
    metadata: {
      reqId,
      attemptNumber,
      retrySource: "user",
      previousJobId,
    },
  });

  if (app.application_status === APPLICATION_STATUS.FAILED || !app.email_subject) {
    let orchestrationMeta = null;
    if (app.application_status === APPLICATION_STATUS.FAILED) {
      const tr = await transitionApplicationState(pool, {
        applicationId,
        userId,
        expectedStatus: APPLICATION_STATUS.FAILED,
        nextStatus: APPLICATION_STATUS.DRAFT,
        clearReviewReason: true,
        patch: { lastError: null, failureStage: null },
        orchestrationBump: "revive_with_transition",
      });
      if (!tr.ok) {
        const err = new Error("State transition conflict");
        err.code = "STATE_TRANSITION_CONFLICT";
        throw err;
      }
      orchestrationMeta = tr.orchestrationMeta;
    } else {
      const tr = await transitionApplicationState(pool, {
        applicationId,
        userId,
        orchestrationBump: "revive",
      });
      if (!tr.ok) {
        const err = new Error("Application not found");
        err.code = "NOT_FOUND";
        throw err;
      }
      orchestrationMeta = tr.orchestrationMeta;
    }
    const dbJob = await createJob({ applicationId, jobType: "ai_process", status: "queued" });
    const { jobId } = await enqueueProcessApplicationJob(applicationId, userId, { dbJobId: dbJob.id });
    logInfo("retry_process_enqueued", buildLogContext({ applicationId, jobId: dbJob.id, userId, reqId }));
    if (!orchestrationMeta) scheduleRevivePublish(applicationId, userId);
    return {
      applicationId,
      status: APPLICATION_STATUS.DRAFT,
      jobId,
      orchestrationEpoch: Number(orchestrationMeta?.orchestration_epoch ?? 0),
      version: Number(orchestrationMeta?.orchestration_version ?? 0),
    };
  }

  if (app.application_status === APPLICATION_STATUS.GENERATED) {
    const email = app.recipient_email || app.jd_contact_email;
    if (!email) {
      const err = new Error("No recipient email");
      err.code = "INVALID_STATE";
      throw err;
    }
    const tr = await transitionApplicationState(pool, {
      applicationId,
      userId,
      orchestrationBump: "revive",
    });
    if (!tr.ok) {
      const err = new Error("Application not found");
      err.code = "NOT_FOUND";
      throw err;
    }
    const sendResult = await requestApplicationSend({
      applicationId,
      userId,
      recipientEmail: email,
    });
    logInfo("retry_send_enqueued", buildLogContext({ applicationId, userId, reqId, sendResult }));
    return {
      applicationId,
      status: APPLICATION_STATUS.GENERATED,
      jobId: sendResult.dbJobId ?? null,
      orchestrationEpoch: Number(tr.orchestrationMeta?.orchestration_epoch ?? 0),
      version: Number(tr.orchestrationMeta?.orchestration_version ?? 0),
    };
  }

  const err = new Error("Retry not applicable");
  err.code = "INVALID_STATE";
  throw err;
}

async function cancelApplication(userId, applicationId, reqId) {
  const app = await getApplicationById(applicationId, userId);
  if (!app) {
    const err = new Error("Application not found");
    err.code = "NOT_FOUND";
    throw err;
  }

  if (app.application_status === APPLICATION_STATUS.SENT) {
    const err = new Error("Cannot cancel sent application");
    err.code = "INVALID_STATE";
    throw err;
  }

  const tr = await transitionApplicationState(pool, {
    applicationId,
    userId,
    expectedStatus: [
      APPLICATION_STATUS.DRAFT,
      APPLICATION_STATUS.GENERATED,
      APPLICATION_STATUS.NEEDS_REVIEW,
      APPLICATION_STATUS.FAILED,
    ],
    nextStatus: APPLICATION_STATUS.CANCELLED,
    clearReviewReason: true,
  });

  if (!tr.ok) {
    const err = new Error("Cancel transition failed");
    err.code = "STATE_TRANSITION_CONFLICT";
    throw err;
  }

  await recordEvent({
    applicationId,
    eventType: "application_cancelled",
    actorType: "user",
    actorId: String(userId),
    metadata: { reqId },
  });

  try {
    await intelligentSendQueueService.cancelQueueEntry(userId, applicationId);
  } catch {
    /* non-fatal */
  }

  return { applicationId, status: APPLICATION_STATUS.CANCELLED };
}

async function patchApplicationEmail(userId, applicationId, { emailSubject, emailBody }, reqId) {
  const trimmedSubject = typeof emailSubject === "string" ? emailSubject.trim() : "";
  const trimmedBody = typeof emailBody === "string" ? emailBody.trim() : "";

  if (!trimmedSubject || !trimmedBody) {
    const err = new Error("emailSubject and emailBody must be non-empty strings");
    err.code = "BAD_REQUEST";
    throw err;
  }
  if (trimmedSubject.length > 500) {
    const err = new Error("emailSubject exceeds 500 characters");
    err.code = "BAD_REQUEST";
    throw err;
  }
  if (trimmedBody.length > 20000) {
    const err = new Error("emailBody exceeds 20000 characters");
    err.code = "BAD_REQUEST";
    throw err;
  }

  const app = await getApplicationById(applicationId, userId);
  if (!app) {
    const err = new Error("Application not found");
    err.code = "NOT_FOUND";
    throw err;
  }

  if (app.application_status !== APPLICATION_STATUS.GENERATED) {
    const err = new Error("Email can only be edited when application is Ready");
    err.code = "INVALID_STATE";
    throw err;
  }

  const updated = await updateApplicationFields(
    applicationId,
    { email_subject: trimmedSubject, email_body: trimmedBody },
    userId
  );

  if (!updated) {
    const err = new Error("Failed to update application email");
    err.code = "INTERNAL_ERROR";
    throw err;
  }

  await recordEvent({
    applicationId,
    eventType: "ready_email_edited",
    actorType: "user",
    actorId: String(userId),
    metadata: { reqId },
  });

  return updated;
}

async function patchApplicationCompany(userId, applicationId, { companyName }, reqId) {
  if (typeof companyName !== "string") {
    const err = new Error("companyName must be a string");
    err.code = "BAD_REQUEST";
    throw err;
  }

  const trimmedCompany = companyName.trim();
  if (!trimmedCompany) {
    const err = new Error("companyName must be non-empty");
    err.code = "BAD_REQUEST";
    throw err;
  }
  if (trimmedCompany.length > 200) {
    const err = new Error("companyName exceeds 200 characters");
    err.code = "BAD_REQUEST";
    throw err;
  }

  const app = await getApplicationById(applicationId, userId);
  if (!app) {
    const err = new Error("Application not found");
    err.code = "NOT_FOUND";
    throw err;
  }

  const normalizedCompany = trimmedCompany.toLowerCase();
  const updated = await withPgTransaction(pool, async (client) => {
    const jdUpdate = await client.query(
      `UPDATE job_descriptions jd
       SET company_name = $3
       FROM applications a
       WHERE a.job_description_id = jd.id
         AND a.id = $1
         AND a.user_id = $2
       RETURNING jd.id`,
      [applicationId, userId, trimmedCompany]
    );
    if (!jdUpdate.rows[0]) {
      const err = new Error("Application not found");
      err.code = "NOT_FOUND";
      throw err;
    }

    return updateApplicationFields(
      applicationId,
      {
        normalized_company_name: normalizedCompany,
        source_company_name: trimmedCompany,
      },
      userId,
      client
    );
  });

  if (!updated) {
    const err = new Error("Failed to update application company");
    err.code = "INTERNAL_ERROR";
    throw err;
  }

  await recordEvent({
    applicationId,
    eventType: "company_name_edited",
    actorType: "user",
    actorId: String(userId),
    metadata: { reqId },
  });

  return updated;
}

module.exports = {
  continueApplication,
  retryApplication,
  cancelApplication,
  patchApplicationEmail,
  patchApplicationCompany,
};
