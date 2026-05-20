const { pool } = require("../db");

/**
 * Append-only application timeline (not source of truth).
 */
async function recordEvent(
  {
    applicationId,
    eventType,
    actorType = "system",
    actorId = null,
    metadata = {},
  },
  client = pool
) {
  const { rows } = await client.query(
    `INSERT INTO application_events (application_id, event_type, actor_type, actor_id, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, created_at`,
    [applicationId, eventType, actorType, actorId, JSON.stringify(metadata)]
  );
  return rows[0];
}

async function listEventsForApplication(applicationId, limit = 50, client = pool) {
  const { rows } = await client.query(
    `SELECT * FROM application_events
     WHERE application_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [applicationId, limit]
  );
  return rows;
}

module.exports = {
  recordEvent,
  listEventsForApplication,
};
