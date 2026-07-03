const { decrypt } = require("../utils/encryption");
const { pool } = require("../db");
const { logInfo } = require("../utils/logger");
const { getApplicationById } = require("../models/applicationModel");
const {
  hasActiveJob,
  hasCompletedSendJob,
} = require("../models/applicationJobModel");
const { requestApplicationSend } = require("../services/sendDispatchService");
const { APPLICATION_STATUS } = require("../domain/applicationStatus/constants/uiStatuses");
const { isDashboardSubmission } = require("./applyModeService");

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

  if (isDashboardSubmission(application.source_platform)) {
    throw Object.assign(
      new Error("Dashboard applications are sent from the dashboard"),
      { stage: "validation", code: "DASHBOARD_SEND_ONLY" }
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

  const sendQueueModel = require("../models/sendQueueModel");
  const { SEND_QUEUE_ENTRY_STATUS } = require("../constants/schedulerState");
  const queueEntry = await sendQueueModel.getQueueEntryByApplicationId(applicationId, userId);
  if (queueEntry?.status === SEND_QUEUE_ENTRY_STATUS.WAITING) {
    logInfo("send_deferred_to_intelligent_queue", { ...meta });
    return { queued: true, intelligentQueue: true };
  }

  return requestApplicationSend({ applicationId, userId, recipientEmail });
};

module.exports = { sendApplication, fetchSmtpCredentials };
