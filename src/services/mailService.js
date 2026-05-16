const nodemailer = require("nodemailer");
const { supabase } = require("../config/supabase");
const { decrypt } = require("../utils/encryption");
const { pool } = require("../db");
const { logInfo, logError } = require("../utils/logger");
const {
  markProcessing,
  markSent,
  markFailed,
  getApplicationById,
} = require("../models/applicationModel");

// ---------------------------------------------------------------------------
// SMTP credentials fetch
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Queue-abstraction boundary
//
// Controllers call ONLY sendApplication() — they have zero knowledge of
// nodemailer, Supabase Storage, or state machine transitions.
//
// This boundary means migrating to BullMQ / SQS in the future requires
// changes only inside this file, not in any controller or route.
// ---------------------------------------------------------------------------

/**
 * Send the application email for a given application ID.
 *
 * Implements a 2-Phase Send:
 *   Phase 1 — markProcessing(): atomically claim the job.
 *             If null → another worker already owns it; return idempotent response.
 *   Phase 2 — download resume, send email, markSent() on success or markFailed() on error.
 *
 * Known edge case (documented, not solved in v1):
 *   sendMail() succeeds → markSent() fails → stale recovery resets to 'pending' → duplicate send.
 *   smtp_message_id column is the foundation for future delivery-tracking mitigation.
 *
 * @param {string} applicationId
 * @param {string} userId
 * @param {string} recipientEmail
 * @param {object} logMeta           - Structured logging context (requestId, etc.)
 * @returns {Promise<{ sent: boolean, alreadyProcessing?: boolean, messageId?: string }>}
 */
const sendApplication = async (applicationId, userId, recipientEmail, logMeta = {}) => {
  const meta = { ...logMeta, applicationId, userId, provider: "smtp" };

  // ── Phase 1: Atomic claim ────────────────────────────────────────────────
  const claimed = await markProcessing(applicationId, userId);
  if (!claimed) {
    logInfo("send_already_processing", { ...meta, state: "processing" });
    return { alreadyProcessing: true };
  }

  logInfo("send_processing_claimed", { ...meta, state: "processing" });

  // ── Phase 2: Send ────────────────────────────────────────────────────────
  try {
    // Fetch full application row (email_subject, email_body, file_path)
    const application = await getApplicationById(applicationId, userId);
    if (!application) {
      // Row disappeared between claim and fetch — extremely unlikely but safe to handle.
      throw Object.assign(new Error("Application row not found after markProcessing"), {
        stage: "validation",
      });
    }

    if (!application.email_subject || !application.email_body) {
      throw Object.assign(
        new Error("email_subject or email_body missing — run /api/apply first"),
        { stage: "validation" }
      );
    }

    if (!application.file_path) {
      throw Object.assign(new Error("Resume file_path missing"), { stage: "storage" });
    }

    // Fetch SMTP credentials
    const credentials = await fetchSmtpCredentials(userId);

    // Download resume PDF from Supabase Storage
    logInfo("storage_download_start", { ...meta, filePath: application.file_path, provider: "supabase" });
    const { data: fileData, error: storageError } = await supabase.storage
      .from("resumes")
      .download(application.file_path);

    if (storageError || !fileData) {
      throw Object.assign(new Error("Storage download failed"), {
        code: "STORAGE_ERROR",
        stage: "storage",
      });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    if (!buffer.length) {
      throw Object.assign(new Error("Empty file buffer from storage"), {
        code: "EMPTY_BUFFER",
        stage: "storage",
      });
    }

    logInfo("storage_download_success", { ...meta, provider: "supabase", bytes: buffer.length });

    // Create SMTP transporter
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: credentials.email, pass: credentials.password },
      connectionTimeout: 10_000,
      greetingTimeout:   10_000,
      socketTimeout:     15_000,
    });

    // Send
    logInfo("smtp_send_start", { ...meta, provider: "smtp" });
    const smtpResult = await transporter.sendMail({
      from:        credentials.email,
      to:          recipientEmail,
      subject:     application.email_subject,
      html:        application.email_body,
      attachments: [
        {
          filename:    "resume.pdf",
          content:     buffer,
          contentType: "application/pdf",
        },
      ],
    });

    // Persist messageId in dedicated column — never in last_error
    const row = await markSent(applicationId, userId, smtpResult.messageId ?? null);

    logInfo("smtp_send_success", {
      ...meta,
      provider: "smtp",
      state: "sent",
      smtpMessageId: smtpResult.messageId,
    });

    return { sent: true, messageId: smtpResult.messageId, sentAt: row?.sent_at };

  } catch (err) {
    if (!err.stage) err.stage = "smtp";

    logError("smtp_send_failed", err, { ...meta, state: "failed", stage: err.stage });

    const updated = await markFailed(applicationId, userId, err.message);

    logInfo("state_transition_failed", {
      ...meta,
      state: updated?.email_status ?? "unknown",
      retryCount: updated?.retry_count ?? null,
    });

    throw err;
  }
};

module.exports = { sendApplication };
