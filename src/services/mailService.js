const { decrypt } = require("../utils/encryption");
const { pool } = require("../db");
const { logInfo } = require("../utils/logger");
const { getApplicationById } = require("../models/applicationModel");
const {
  createJob,
  hasActiveJob,
  hasCompletedSendJob,
} = require("../models/applicationJobModel");
const { enqueueSendJob } = require("../queues/sendApplicationQueue");
const { APPLICATION_STATUS } = require("../domain/applicationStatus/constants/uiStatuses");

const fetchSmtpCredentials = async (userId) => {
  const { rows } = await pool.query(
    "SELECT email, encrypted_app_password FROM user_email_credentials WHERE user_id = $1",
    [userId]
  );
  if (rows.length === 0) {
    throw Object.assign(new Error("No email credentials found for user"), {
      code: "NO_CREDENTIALS",
      stage: "smtp",
    });
  }
  return {
    email: rows[0].email,
    password: decrypt(rows[0].encrypted_app_password),
  };
};

/**
 * Queue-boundary for manual send — enqueues BullMQ job, no SMTP in HTTP path.
 */
const sendApplication = async (applicationId, userId, recipientEmail, logMeta = {}) => {
  const meta = { ...logMeta, applicationId, userId, provider: "smtp" };

  const application = await getApplicationById(applicationId, userId);
  if (!application) {
    throw Object.assign(new Error("Application not found"), { stage: "validation" });
  }

  if (application.application_status === APPLICATION_STATUS.SENT) {
    return { sent: true, alreadySent: true };
  }

  if (application.application_status === APPLICATION_STATUS.CANCELLED) {
    throw Object.assign(new Error("Application cancelled"), { stage: "validation" });
  }

  if (application.application_status === APPLICATION_STATUS.NEEDS_REVIEW) {
    throw Object.assign(new Error("Application needs review — use continue endpoint"), {
      stage: "validation",
    });
  }

  if (application.application_status !== APPLICATION_STATUS.GENERATED) {
    throw Object.assign(
      new Error("Application is not ready to send — wait for processing to complete"),
      { stage: "validation" }
    );
  }

  if (!application.email_subject || !application.email_body) {
    throw Object.assign(new Error("email_subject or email_body missing"), { stage: "validation" });
  }

  if (await hasCompletedSendJob(applicationId)) {
    return { sent: true, alreadySent: true };
  }

  if (await hasActiveJob(applicationId, "send_email")) {
    logInfo("send_already_processing", { ...meta, state: "processing" });
    return { alreadyProcessing: true };
  }

  const dbJob = await createJob({
    applicationId,
    jobType: "send_email",
    status: "queued",
  });

  await enqueueSendJob(applicationId, userId, recipientEmail, { dbJobId: dbJob.id });
  logInfo("send_enqueued", { ...meta, dbJobId: dbJob.id });

  return { queued: true, status: "queued" };
};

module.exports = { sendApplication, fetchSmtpCredentials };
