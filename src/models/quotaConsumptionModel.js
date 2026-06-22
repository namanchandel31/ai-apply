const { pool } = require("../db");

async function recordConsumption(applicationId, userId, featureKey, client = pool) {
  const { rows } = await pool.query(
    `INSERT INTO quota_consumption_events (application_id, user_id, feature_key)
     VALUES ($1, $2, $3)
     ON CONFLICT (application_id) DO NOTHING
     RETURNING application_id`,
    [applicationId, userId, featureKey]
  );
  return rows.length > 0;
}

async function hasConsumed(applicationId, client = pool) {
  const { rows } = await client.query(
    `SELECT 1 FROM quota_consumption_events WHERE application_id = $1 LIMIT 1`,
    [applicationId]
  );
  return rows.length > 0;
}

async function recordReconciliation({ applicationId, userId, eventType, details }, client = pool) {
  await client.query(
    `INSERT INTO quota_reconciliation_events (application_id, user_id, event_type, details)
     VALUES ($1, $2, $3, $4)`,
    [applicationId, userId, eventType, details ? JSON.stringify(details) : null]
  );
}

async function listFailedConsumptions(limit = 50, client = pool) {
  const { rows } = await client.query(
    `SELECT DISTINCT ON (r.application_id) r.application_id, r.user_id
     FROM quota_reconciliation_events r
     LEFT JOIN quota_consumption_events c ON c.application_id = r.application_id
     WHERE r.event_type = 'consume_failed' AND c.application_id IS NULL
     ORDER BY r.application_id, r.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

module.exports = { recordConsumption, hasConsumed, recordReconciliation, listFailedConsumptions };
