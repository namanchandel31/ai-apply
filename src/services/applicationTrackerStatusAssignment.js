const { pool } = require("../db");
const { getTrackerStatusOptions, EMAIL_SENT_TRACKER_STATUS } = require("./trackerStatusService");

/**
 * Assign the system "Email sent" tracker status after SMTP success.
 * Lives outside applicationModel to avoid model ↔ trackerStatusService import cycles.
 */
async function autoAssignEmailSentTrackerStatus(userId, applicationId, client = pool) {
  if (!userId || !applicationId) return null;

  await getTrackerStatusOptions(userId, client);

  const { rows } = await client.query(
    `UPDATE applications
     SET tracker_status_id = $3, updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING tracker_status_id`,
    [applicationId, userId, EMAIL_SENT_TRACKER_STATUS.id]
  );

  return rows[0]?.tracker_status_id ?? null;
}

module.exports = { autoAssignEmailSentTrackerStatus };
