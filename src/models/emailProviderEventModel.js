const { pool } = require("../db");

/**
 * Append-only operational/audit trail for email provider integrations.
 * NOT source-of-truth state — the authoritative connection state lives on
 * email_accounts. Never store tokens in metadata.
 */
const EVENT_TYPES = Object.freeze({
  GMAIL_CONNECTED: "gmail_connected",
  GMAIL_DISCONNECTED: "gmail_disconnected",
  TOKEN_REFRESHED: "token_refreshed",
  TOKEN_REFRESH_FAILED: "token_refresh_failed",
  TOKEN_REVOKED: "token_revoked",
  SCOPE_UPGRADED: "scope_upgraded",
  SCOPE_DOWNGRADED: "scope_downgraded",
  SEND_PROVIDER_CHANGED: "send_provider_changed",
});

async function recordProviderEvent(
  { userId, emailAccountId = null, provider, eventType, metadata = {} },
  client = pool
) {
  const { rows } = await client.query(
    `INSERT INTO email_provider_events (user_id, email_account_id, provider, event_type, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, created_at`,
    [userId, emailAccountId, provider, eventType, JSON.stringify(metadata)]
  );
  return rows[0];
}

async function listForUser(userId, limit = 50, client = pool) {
  const { rows } = await client.query(
    `SELECT * FROM email_provider_events
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

module.exports = { EVENT_TYPES, recordProviderEvent, listForUser };
