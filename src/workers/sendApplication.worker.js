const { Worker, UnrecoverableError } = require("bullmq");
const nodemailer = require("nodemailer");
const { connection } = require("../queues/connection");
const { QUEUE_NAME } = require("../queues/sendApplicationQueue");
const { getApplicationById, markProcessingFromQueued, markSent, markFailed } = require("../models/applicationModel");
const { fetchSmtpCredentials } = require("../services/mailService");
const { supabase } = require("../config/supabase");
const { logInfo, logError } = require("../utils/logger");

const processor = async (job) => {
  const { applicationId, userId, recipientEmail } = job.data;
  const reqId = job.id; // use BullMQ job ID as trace ID

  logInfo("WORKER_JOB_START", { reqId, applicationId, userId, attempt: job.attemptsMade });

  // 1. CAS: queued -> processing
  const claimed = await markProcessingFromQueued(applicationId);
  if (!claimed) {
    logInfo("WORKER_CLAIM_SKIPPED", { reqId, applicationId, reason: "Already claimed" });
    return;
  }
  logInfo("WORKER_CLAIM_SUCCESS", { reqId, applicationId });

  try {
    // 2. Fetch application row for subject, body, resume_snapshot_path
    const application = await getApplicationById(applicationId, userId);
    if (!application) {
      throw new UnrecoverableError(`Application not found: ${applicationId}`);
    }

    // 3. Fetch & Decrypt SMTP Credentials (never log plaintext)
    let credentials;
    try {
      credentials = await fetchSmtpCredentials(userId);
    } catch (err) {
      // Missing or invalid credentials is a permanent failure
      const errorObj = new Error(`Credential error: ${err.message}`);
      errorObj.stage = "credential_decrypt";
      throw errorObj;
    }

    // 4. Download Resume from Supabase
    let fileBuffer;
    try {
      const { data, error } = await supabase.storage
        .from("resumes")
        .download(application.resume_snapshot_path);

      if (error) {
        const msg = error.message || "";
        const isPermanent = error.status === 404 || msg.includes("not found") || msg.includes("invalid path");
        if (isPermanent) {
          throw new UnrecoverableError(`Resume not found in storage: ${application.resume_snapshot_path}`);
        }
        // Transient error
        throw new Error(`Transient storage error: ${msg}`);
      }
      
      if (!data) throw new UnrecoverableError("Storage returned null file data");
      
      // Convert Blob to Buffer
      const arrayBuffer = await data.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
    } catch (err) {
      if (err instanceof UnrecoverableError) {
        err.stage = "resume_download";
        throw err;
      }
      const errorObj = new Error(err.message);
      errorObj.stage = "resume_download";
      throw errorObj;
    }

    // 5. Setup SMTP Transporter with timeouts
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: credentials.email,
        pass: credentials.password
      },
      connectionTimeout: 10000, // 10s
      greetingTimeout: 10000,   // 10s
      socketTimeout: 15000      // 15s
    });

    // TODO [SMTP-POOL]: For high-volume sends, replace createTransport() per job with a shared pool.
    // TODO [SMTP-TLS]: Handle port 465 / secure: true for non-Gmail providers.
    // TODO [SMTP-BURST]: Per-user send throttle to protect Gmail reputation.

    // 6. Send Email
    let smtpResult;
    try {
      smtpResult = await transporter.sendMail({
        from: credentials.email,
        to: recipientEmail,
        subject: application.email_subject,
        text: application.email_body,
        attachments: [
          {
            filename: "resume.pdf",
            content: fileBuffer,
            contentType: "application/pdf"
          }
        ]
      });
    } catch (err) {
      const PERMANENT_CODES = ["EAUTH", "EENVELOPE", "ERECIPIENT"];
      if (PERMANENT_CODES.includes(err.code)) {
        const permErr = new UnrecoverableError(`Permanent SMTP failure [${err.code}]: ${err.message}`);
        permErr.stage = "smtp_send";
        throw permErr;
      }
      const errorObj = new Error(err.message);
      errorObj.stage = "smtp_send";
      throw errorObj;
    }

    // 7. Success
    await markSent(applicationId, userId, smtpResult.messageId);
    logInfo("EMAIL_SENT", { reqId, applicationId, messageId: smtpResult.messageId });

  } catch (err) {
    const failureStage = err.stage || "unknown";
    
    // Mark failed in DB
    try {
      await markFailed(applicationId, err.message, failureStage, userId);
      logError("EMAIL_FAILED", err, { reqId, applicationId, failureStage });
    } catch (dbErr) {
      logError("MARK_FAILED_ERROR", dbErr, { reqId, applicationId });
    }

    // Re-throw for BullMQ
    if (err instanceof UnrecoverableError) {
      throw err; // Skips retries
    }
    throw err; // Retries according to backoff
  }
};

const worker = new Worker(QUEUE_NAME, processor, {
  connection,
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || "3", 10),
});

worker.on("failed", (job, err) => {
  logError("BULLMQ_JOB_FAILED", err, { jobId: job?.id });
});

worker.on("error", err => {
  logError("BULLMQ_WORKER_ERROR", err);
});

module.exports = { worker };

// TODO [CIRCUIT-BREAKER]: Track consecutive SMTP failures per provider. Pause queue if > 10.
// TODO [PROVIDER-CONCURRENCY]: Split to per-provider sub-queues (send-gmail, send-outlook) with specific limits.
