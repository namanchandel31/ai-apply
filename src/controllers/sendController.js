const { sendApplication } = require("../services/mailService");
const { getUserId } = require("../utils/auth");
const { logInfo, logError } = require("../utils/logger");
const { error, ok, ERROR_CODES } = require("../utils/response");

const sendApplicationController = async (req, res) => {
  const reqId = req.requestId || "UNKNOWN";
  const { applicationId } = req.params;
  const userId = getUserId(req);
  const meta = { reqId, applicationId, userId };

  try {
    logInfo("send_application_start", meta);

    // Validate recipient email (override or fall back handled inside sendApplication)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const rawRecipient = req.body?.recipientEmail;
    let recipientEmail = null;

    if (rawRecipient) {
      const normalized = rawRecipient.trim().toLowerCase();
      if (emailRegex.test(normalized)) {
        recipientEmail = normalized;
      } else {
        return error(res, 400, "Invalid recipientEmail format", ERROR_CODES.BAD_REQUEST);
      }
    }

    // Fetch the application to resolve the JD contact email if no override provided.
    // Full ownership check is enforced inside getApplicationById (user_id in WHERE).
    const { pool } = require("../db");
    const { rows: apps } = await pool.query(
      `SELECT a.email_subject, a.email_body, a.email_status, a.file_path,
              jd.contact_email as jd_contact_email
       FROM applications a
       JOIN job_descriptions jd ON jd.id = a.job_description_id
       LEFT JOIN resumes r ON r.id = a.resume_id
       WHERE a.id = $1 AND a.user_id = $2`,
      [applicationId, userId]
    );

    if (apps.length === 0) {
      return error(res, 404, "Application not found", ERROR_CODES.NOT_FOUND);
    }

    const application = apps[0];

    // Resolve recipient
    if (!recipientEmail && application.jd_contact_email) {
      const jdEmail = application.jd_contact_email.trim().toLowerCase();
      if (emailRegex.test(jdEmail)) recipientEmail = jdEmail;
    }

    if (!recipientEmail) {
      return error(res, 400, "Valid recipient email is required (none found in request or JD)", ERROR_CODES.BAD_REQUEST);
    }

    // Guard: already in a terminal state — idempotent short-circuit
    if (application.email_status === "sent") {
      logInfo("send_already_sent", { ...meta, state: "sent" });
      return ok(res, { status: "sent", message: "Application already sent" });
    }

    if (application.email_status === "abandoned") {
      return error(res, 409, "Application has been permanently abandoned after exceeding max retries", "ABANDONED");
    }

    // ── Delegate everything to the service (queue-boundary) ─────────────────
    const result = await sendApplication(applicationId, userId, recipientEmail, meta);

    if (result.alreadyProcessing) {
      logInfo("send_already_processing", { ...meta, state: "processing" });
      return ok(res, { status: "processing", message: "Send already in progress" });
    }

    logInfo("send_application_success", { ...meta, state: "sent" });

    return ok(res, {
      messageId: result.messageId,
      status:    "sent",
      sentAt:    result.sentAt,
      message:   "Application sent successfully",
    });

  } catch (err) {
    logError("send_application_error", err, meta);

    if (err.stage === "validation") {
      return error(res, 400, err.message, ERROR_CODES.BAD_REQUEST);
    }
    if (err.stage === "storage") {
      return error(res, 502, `Storage error: ${err.message}`, "STORAGE_ERROR");
    }

    return error(res, 500, `Failed to send application: ${err.message}`, ERROR_CODES.INTERNAL_ERROR);
  }
};

module.exports = { sendApplicationController };
