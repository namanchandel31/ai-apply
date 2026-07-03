const { requestApplicationSend } = require("./sendDispatchService");
const { DASHBOARD_SOURCE_PLATFORM } = require("./applyModeService");
const { logInfo, logError } = require("../utils/logger");
const { buildLogContext } = require("../utils/buildLogContext");
const { flushRealtimeAfterDbCommit } = require("../realtime/postCommitFlush");

const PENDING_SEND_SQL = `
  SELECT a.id, a.user_id, a.recipient_email, jd.contact_email
  FROM applications a
  JOIN job_descriptions jd ON jd.id = a.job_description_id
  WHERE a.source_platform = $1
    AND a.application_status = 'generated'
    AND NOT EXISTS (
      SELECT 1 FROM application_jobs j
      WHERE j.application_id = a.id AND j.job_type = 'send_email'
    )
    AND COALESCE(NULLIF(TRIM(a.recipient_email), ''), NULLIF(TRIM(jd.contact_email), '')) IS NOT NULL
`;

async function findDashboardApplicationsPendingSend(client) {
  const { rows } = await client.query(PENDING_SEND_SQL, [DASHBOARD_SOURCE_PLATFORM]);
  return rows;
}

/**
 * Dashboard submissions should auto-send after processing. If an older worker left
 * them at generated + Email Ready without a send job, enqueue send here.
 */
async function recoverDashboardPendingSends(client) {
  const rows = await findDashboardApplicationsPendingSend(client);
  if (!rows.length) return { recovered: 0 };

  let recovered = 0;
  for (const row of rows) {
    const email = String(row.recipient_email || row.contact_email)
      .trim()
      .toLowerCase();
    const ctx = buildLogContext({
      applicationId: row.id,
      userId: row.user_id,
      source: "dashboard_send_recovery",
    });

    try {
      await requestApplicationSend({
        applicationId: row.id,
        userId: row.user_id,
        recipientEmail: email,
      });
      await flushRealtimeAfterDbCommit([row.id]);
      recovered += 1;
      logInfo("RECOVERY_DASHBOARD_SEND_ENQUEUED", { ...ctx, email });
    } catch (err) {
      logError("RECOVERY_DASHBOARD_SEND_FAILED", err, ctx);
    }
  }

  return { recovered };
}

module.exports = {
  findDashboardApplicationsPendingSend,
  recoverDashboardPendingSends,
  PENDING_SEND_SQL,
};
