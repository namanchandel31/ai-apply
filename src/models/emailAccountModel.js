const { pool } = require("../db");
const { withPgTransaction } = require("../db/pgClient");

const COLUMNS = `
  id, user_id, provider, auth_method, email_address, provider_account_id,
  status, health_status, is_default, granted_scopes, can_send, can_read,
  encrypted_refresh_token, encrypted_access_token, access_token_expires_at,
  last_connected_at, last_refreshed_at, last_used_at, last_error,
  created_at, updated_at
`;

async function getById(id, client = pool) {
  const { rows } = await client.query(
    `SELECT ${COLUMNS} FROM email_accounts WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

async function getDefaultAccount(userId, client = pool) {
  const { rows } = await client.query(
    `SELECT ${COLUMNS} FROM email_accounts
     WHERE user_id = $1 AND is_default = TRUE
     LIMIT 1`,
    [userId]
  );
  return rows[0] ?? null;
}

async function getByUserAndProvider(userId, provider, client = pool) {
  const { rows } = await client.query(
    `SELECT ${COLUMNS} FROM email_accounts
     WHERE user_id = $1 AND provider = $2
     ORDER BY is_default DESC, created_at DESC
     LIMIT 1`,
    [userId, provider]
  );
  return rows[0] ?? null;
}

async function listByUser(userId, client = pool) {
  const { rows } = await client.query(
    `SELECT ${COLUMNS} FROM email_accounts
     WHERE user_id = $1
     ORDER BY is_default DESC, created_at DESC`,
    [userId]
  );
  return rows;
}

/**
 * Upserts an OAuth-connected account and makes it the user's default.
 *
 * Refresh-token preservation (critical OAuth edge case): Google only returns a
 * refresh_token on first consent (or forced re-consent). On reconnect it is often
 * absent — so we COALESCE to keep the existing encrypted token unless a new one
 * is actually provided. See docs/backend/gmail-oauth.md.
 */
async function upsertOAuthAccount(input, externalClient = null) {
  const run = async (client) => {
    // Enforce a single default account per user.
    await client.query(
      `UPDATE email_accounts SET is_default = FALSE WHERE user_id = $1 AND is_default = TRUE`,
      [input.userId]
    );

    const { rows } = await client.query(
      `INSERT INTO email_accounts (
         user_id, provider, auth_method, email_address, provider_account_id,
         status, health_status, is_default, granted_scopes, can_send, can_read,
         encrypted_refresh_token, encrypted_access_token, access_token_expires_at,
         last_connected_at, last_refreshed_at
       )
       VALUES (
         $1, $2, $3, $4, $5,
         'connected', 'healthy', TRUE, $6, $7, $8,
         $9, $10, $11,
         NOW(), NOW()
       )
       ON CONFLICT (user_id, provider, email_address) DO UPDATE SET
         auth_method = EXCLUDED.auth_method,
         provider_account_id = COALESCE(EXCLUDED.provider_account_id, email_accounts.provider_account_id),
         status = 'connected',
         health_status = 'healthy',
         is_default = TRUE,
         granted_scopes = EXCLUDED.granted_scopes,
         can_send = EXCLUDED.can_send,
         can_read = EXCLUDED.can_read,
         -- Never overwrite a valid refresh token with NULL.
         encrypted_refresh_token = COALESCE(EXCLUDED.encrypted_refresh_token, email_accounts.encrypted_refresh_token),
         encrypted_access_token = EXCLUDED.encrypted_access_token,
         access_token_expires_at = EXCLUDED.access_token_expires_at,
         last_connected_at = NOW(),
         last_refreshed_at = NOW(),
         last_error = NULL
       RETURNING ${COLUMNS}`,
      [
        input.userId,
        input.provider,
        input.authMethod || "oauth2",
        input.emailAddress,
        input.providerAccountId ?? null,
        input.grantedScopes || [],
        !!input.canSend,
        !!input.canRead,
        input.encryptedRefreshToken ?? null,
        input.encryptedAccessToken ?? null,
        input.accessTokenExpiresAt ?? null,
      ]
    );
    return rows[0];
  };

  if (externalClient) return run(externalClient);
  return withPgTransaction(pool, run);
}

/**
 * Persists a refreshed access token. Refresh token is only replaced when a new
 * non-null value is provided (COALESCE) — same preservation rule as upsert.
 */
async function updateAccessToken(id, { encryptedAccessToken, accessTokenExpiresAt, encryptedRefreshToken = null }, client = pool) {
  const { rows } = await client.query(
    `UPDATE email_accounts SET
       encrypted_access_token = $2,
       access_token_expires_at = $3,
       encrypted_refresh_token = COALESCE($4, encrypted_refresh_token),
       last_refreshed_at = NOW(),
       status = 'connected',
       last_error = NULL
     WHERE id = $1
     RETURNING ${COLUMNS}`,
    [id, encryptedAccessToken, accessTokenExpiresAt, encryptedRefreshToken]
  );
  return rows[0] ?? null;
}

async function markStatus(id, status, lastError = null, client = pool) {
  const { rows } = await client.query(
    `UPDATE email_accounts SET status = $2, last_error = $3 WHERE id = $1 RETURNING ${COLUMNS}`,
    [id, status, lastError]
  );
  return rows[0] ?? null;
}

async function markHealth(id, healthStatus, lastError = null, client = pool) {
  const { rows } = await client.query(
    `UPDATE email_accounts SET health_status = $2, last_error = COALESCE($3, last_error) WHERE id = $1 RETURNING ${COLUMNS}`,
    [id, healthStatus, lastError]
  );
  return rows[0] ?? null;
}

async function touchLastUsed(id, client = pool) {
  await client.query(
    `UPDATE email_accounts SET last_used_at = NOW(), health_status = 'healthy', last_error = NULL WHERE id = $1`,
    [id]
  );
}

async function deleteById(id, client = pool) {
  await client.query(`DELETE FROM email_accounts WHERE id = $1`, [id]);
}

module.exports = {
  getById,
  getDefaultAccount,
  getByUserAndProvider,
  listByUser,
  upsertOAuthAccount,
  updateAccessToken,
  markStatus,
  markHealth,
  touchLastUsed,
  deleteById,
};
