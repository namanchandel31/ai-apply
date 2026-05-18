const { pool } = require("../db");
const { logInfo, logError } = require("../utils/logger");
const { enqueueSendJob } = require("../queues/sendApplicationQueue");
const { markAbandoned } = require("../models/applicationModel");

/**
 * Re-enqueues jobs that have been stuck in 'queued' for >5 minutes without processing_started_at.
 */
async function recoverStuckQueued(client) {
  const { rows } = await client.query(
    `SELECT a.id, a.user_id, jd.contact_email AS recipient_email 
     FROM applications a
     LEFT JOIN job_descriptions jd ON a.job_description_id = jd.id
     WHERE a.email_status = 'queued' 
       AND a.processing_started_at IS NULL 
       AND a.created_at < NOW() - interval '5 minutes'`
  );

  for (const row of rows) {
    if (!row.recipient_email) {
      logInfo("APPLICATION_RECOVERY_SKIPPED_NO_CONTACT_EMAIL", { applicationId: row.id, reason: "Missing contact_email in job_descriptions" });
      await markAbandoned(row.id, "missing_contact_email_recovery");
      continue;
    }

    try {
      await enqueueSendJob(row.id, row.user_id, row.recipient_email);
      logInfo("RECOVERY_QUEUED_REENQUEUED", { applicationId: row.id });
    } catch (err) {
      logError("RECOVERY_REENQUEUE_FAILED", err, { applicationId: row.id });
    }
  }
}

/**
 * Recovers jobs stuck in 'processing' for >15 minutes.
 * Resets them to 'queued' or marks them 'abandoned' if max attempts reached.
 */
async function recoverStalledProcessing(client) {
  const { rows } = await client.query(
    `SELECT id, processing_attempts 
     FROM applications
     WHERE email_status = 'processing' 
       AND processing_started_at < NOW() - interval '15 minutes'`
  );

  const MAX = parseInt(process.env.MAX_PROCESSING_ATTEMPTS || "5", 10);

  for (const row of rows) {
    if (row.processing_attempts >= MAX) {
      await markAbandoned(row.id, "recovery_abandoned");
      logInfo("APPLICATION_ABANDONED", { applicationId: row.id, processing_attempts: row.processing_attempts });
    } else {
      await client.query(
        `UPDATE applications 
         SET email_status='queued', processing_started_at=NULL
         WHERE id=$1 AND email_status='processing'`,
        [row.id]
      );
      logInfo("RECOVERY_PROCESSING_RESET", { applicationId: row.id });
    }
  }
}

/**
 * Runs the recovery routines wrapped in a PostgreSQL advisory lock
 * to ensure singleton safety across horizontally scaled instances.
 */
async function runRecovery() {
  const client = await pool.connect();
  let lockAcquired = false;

  try {
    const { rows } = await client.query("SELECT pg_try_advisory_lock(987654321) AS acquired");
    lockAcquired = rows[0].acquired;

    if (!lockAcquired) {
      logInfo("RECOVERY_LOCK_SKIPPED", { reason: "another instance holds lock" });
      return;
    }

    logInfo("RECOVERY_LOCK_ACQUIRED");
    await recoverStuckQueued(client);
    await recoverStalledProcessing(client);

  } finally {
    if (lockAcquired) {
      await client.query("SELECT pg_advisory_unlock(987654321)");
      logInfo("RECOVERY_LOCK_RELEASED");
    }
    client.release();
  }
}

/**
 * Recursive timeout loop to prevent overlapping recovery executions.
 */
async function recoveryLoop() {
  logInfo("RECOVERY_LOOP_STARTED");
  try {
    await runRecovery();
    logInfo("RECOVERY_LOOP_COMPLETED");
  } catch (err) {
    logError("RECOVERY_LOOP_ERROR", err);
  } finally {
    setTimeout(recoveryLoop, 5 * 60 * 1000); // 5 minutes
  }
}

// TODO [SHUTDOWN]: Track setTimeout reference for graceful process exit:
// let recoveryTimer = null;
// ... finally { recoveryTimer = setTimeout(recoveryLoop, 5 * 60 * 1000); }
// function stopRecoveryLoop() { if (recoveryTimer) clearTimeout(recoveryTimer); }

// TODO [METRICS]: Future metrics roadmap:
// - recovery_reenqueued_total
// - recovery_abandoned_total

module.exports = {
  recoveryLoop,
  runRecovery, // Exported for unit testing
};
