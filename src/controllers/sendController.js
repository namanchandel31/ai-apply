const { sendApplication } = require("../services/mailService");
const { getUserId } = require("../utils/auth");
const { logInfo, logError } = require("../utils/logger");
const { ok, ERROR_CODES } = require("../utils/response");
const { sendError } = require("../utils/httpErrorResponse");
const { buildLogContext } = require("../utils/buildLogContext");
const quotaService = require("../services/quotaService");
const { isQuotaError, sendQuotaExceeded } = require("../utils/quotaErrorResponse");

const sendApplicationController = async (req, res) => {
  const reqId = req.requestId || "UNKNOWN";
  const { applicationId } = req.params;
  const userId = getUserId(req);
  const meta = buildLogContext({ reqId, applicationId, userId });

  try {
    logInfo("send_application_start", meta);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const rawRecipient = req.body?.recipientEmail;
    let recipientEmail = null;

    if (rawRecipient) {
      const normalized = rawRecipient.trim().toLowerCase();
      if (emailRegex.test(normalized)) {
        recipientEmail = normalized;
      } else {
        return sendError(res, {
          status: 400,
          code: ERROR_CODES.BAD_REQUEST,
          message: "Invalid recipientEmail format",
          retryable: false,
        });
      }
    }

    const { pool } = require("../db");
    const { rows: apps } = await pool.query(
      `SELECT a.email_subject, a.email_body, a.application_status,
              r.file_path,
              jd.contact_email AS jd_contact_email
       FROM applications a
       JOIN job_descriptions jd ON jd.id = a.job_description_id
       LEFT JOIN resumes r ON r.id = a.resume_id
       WHERE a.id = $1 AND a.user_id = $2`,
      [applicationId, userId]
    );

    if (apps.length === 0) {
      return sendError(res, {
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: "Application not found",
        retryable: false,
      });
    }

    const application = apps[0];

    if (!recipientEmail && application.jd_contact_email) {
      const jdEmail = application.jd_contact_email.trim().toLowerCase();
      if (emailRegex.test(jdEmail)) recipientEmail = jdEmail;
    }

    if (!recipientEmail) {
      return sendError(res, {
        status: 400,
        code: ERROR_CODES.BAD_REQUEST,
        message: "Valid recipient email is required (none found in request or JD)",
        retryable: false,
      });
    }

    if (application.application_status === "sent") {
      logInfo("send_already_sent", { ...meta, state: "sent" });
      return ok(res, { status: "sent", message: "Application already sent" });
    }

    if (application.application_status === "cancelled") {
      return sendError(res, {
        status: 409,
        code: "CANCELLED",
        message: "Application has been cancelled",
        retryable: false,
      });
    }

    if (application.application_status === "failed") {
      return sendError(res, {
        status: 409,
        code: "FAILED",
        message: "Application failed — use retry endpoint",
        retryable: false,
      });
    }

    // Fast paywall feedback before queueing. Advisory only: the send worker performs the
    // authoritative atomic reserve right before delivery, so this can't overshoot.
    const quota = await quotaService.check(userId, quotaService.QUOTA_FEATURE_KEYS.APPLICATION_SENT);
    if (!quota.allowed) {
      return sendQuotaExceeded(res, {
        feature: quotaService.QUOTA_FEATURE_KEYS.APPLICATION_SENT,
        limit: quota.limit,
        used: quota.used,
        remaining: quota.remaining,
      });
    }

    const result = await sendApplication(applicationId, userId, recipientEmail, meta);

    if (result.alreadyProcessing) {
      logInfo("send_already_processing", { ...meta, state: "processing" });
      return ok(res, { status: "processing", message: "Send already in progress" });
    }

    if (result.alreadySent || result.sent) {
      return ok(res, { status: "sent", message: "Application already sent" });
    }

    if (result.queued) {
      return res.status(202).json({
        success: true,
        data: { status: "queued", message: "Send queued — worker will deliver email" },
      });
    }

    logInfo("send_application_success", { ...meta, state: "sent" });
    return ok(res, {
      messageId: result.messageId,
      status: "sent",
      sentAt: result.sentAt,
      message: "Application sent successfully",
    });
  } catch (err) {
    if (isQuotaError(err)) {
      return sendQuotaExceeded(res, err);
    }

    logError("send_application_error", err, meta);

    if (err.stage === "validation") {
      return sendError(res, {
        status: 400,
        code: ERROR_CODES.BAD_REQUEST,
        message: "Invalid send request",
        retryable: false,
      });
    }
    if (err.stage === "storage") {
      return sendError(res, {
        status: 502,
        code: "STORAGE_ERROR",
        message: "Storage error while sending application",
        retryable: true,
      });
    }

    return sendError(res, {
      status: 500,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: "Failed to send application",
      retryable: true,
    });
  }
};

module.exports = { sendApplicationController };
