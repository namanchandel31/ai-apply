const { pool } = require("../db");

const PRIORITY_OFFSET = 10000;

const SELECT_FIELDS = `
  id, provider, provider_type as "providerType", selected_model as "selectedModel",
  base_url as "baseUrl", label, is_active as "isActive",
  allow_platform_fallback as "allowPlatformFallback",
  priority, health_status as "healthStatus", health_updated_at as "healthUpdatedAt",
  in_fallback_chain as "inFallbackChain",
  encrypted_api_key as "encryptedApiKey",
  encrypted_api_key IS NOT NULL as "hasApiKey",
  created_at as "createdAt", updated_at as "updatedAt"
`;

async function listByUser(userId) {
  const { rows } = await pool.query(
    `SELECT ${SELECT_FIELDS}
     FROM user_ai_credentials WHERE user_id = $1
     ORDER BY priority ASC, created_at ASC`,
    [userId]
  );
  return rows;
}

async function getPrimaryByUser(userId) {
  const { rows } = await pool.query(
    `SELECT ${SELECT_FIELDS}
     FROM user_ai_credentials WHERE user_id = $1 AND priority = 0 LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function getActiveByUser(userId) {
  return getPrimaryByUser(userId);
}

async function getById(id, userId) {
  const { rows } = await pool.query(
    `SELECT ${SELECT_FIELDS}
     FROM user_ai_credentials WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return rows[0] || null;
}

async function applyPriorities(client, userId, orderedIds) {
  await client.query(
    `UPDATE user_ai_credentials SET priority = priority + $2, updated_at = NOW() WHERE user_id = $1`,
    [userId, PRIORITY_OFFSET]
  );

  for (let i = 0; i < orderedIds.length; i++) {
    await client.query(
      `UPDATE user_ai_credentials
       SET priority = $3, is_active = ($3 = 0), updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [orderedIds[i], userId, i]
    );
  }
}

async function upsertCredential({
  userId,
  provider,
  providerType,
  encryptedApiKey,
  selectedModel,
  baseUrl,
  label,
  allowPlatformFallback,
  role,
}) {
  const client = await pool.connect();
  const isPrimary = role !== "backup";

  try {
    await client.query("BEGIN");

    const { rows: existing } = await client.query(
      `SELECT id FROM user_ai_credentials
       WHERE user_id = $1 AND provider = $2 AND label = $3`,
      [userId, provider, label || provider]
    );

    let credentialId;

    if (existing.length) {
      const { rows } = await client.query(
        `UPDATE user_ai_credentials SET
           provider_type = $2,
           encrypted_api_key = COALESCE($3, encrypted_api_key),
           selected_model = $4,
           base_url = $5,
           allow_platform_fallback = $6,
           health_status = CASE WHEN health_status = 'invalid' THEN health_status ELSE 'healthy' END,
           updated_at = NOW()
         WHERE id = $1 AND user_id = $7
         RETURNING id`,
        [
          existing[0].id,
          providerType,
          encryptedApiKey,
          selectedModel,
          baseUrl,
          allowPlatformFallback || false,
          userId,
        ]
      );
      credentialId = rows[0].id;
    } else {
      const allRows = await client.query(
        `SELECT id FROM user_ai_credentials WHERE user_id = $1 ORDER BY priority ASC`,
        [userId]
      );

      let insertPriority = 0;
      if (!isPrimary) {
        insertPriority = allRows.rows.length;
      } else if (allRows.rows.length > 0) {
        await client.query(
          `UPDATE user_ai_credentials SET priority = priority + $2, updated_at = NOW() WHERE user_id = $1`,
          [userId, PRIORITY_OFFSET]
        );
        insertPriority = 0;
      }

      const { rows } = await client.query(
        `INSERT INTO user_ai_credentials
          (user_id, provider, provider_type, encrypted_api_key, selected_model, base_url, label,
           allow_platform_fallback, is_active, priority, health_status, in_fallback_chain, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'healthy', true, NOW())
         RETURNING id`,
        [
          userId,
          provider,
          providerType,
          encryptedApiKey,
          selectedModel,
          baseUrl,
          label || provider,
          allowPlatformFallback || false,
          isPrimary,
          insertPriority,
        ]
      );
      credentialId = rows[0].id;

      if (isPrimary && allRows.rows.length > 0) {
        const orderedIds = [credentialId, ...allRows.rows.map((r) => r.id)];
        await applyPriorities(client, userId, orderedIds);
      }
    }

    if (isPrimary && existing.length) {
      const all = await client.query(`SELECT id FROM user_ai_credentials WHERE user_id = $1`, [userId]);
      const orderedIds = [
        credentialId,
        ...all.rows.filter((r) => r.id !== credentialId).map((r) => r.id),
      ];
      await applyPriorities(client, userId, orderedIds);
    }

    const { rows: result } = await client.query(
      `SELECT id, provider, provider_type as "providerType", selected_model as "selectedModel",
              base_url as "baseUrl", label, is_active as "isActive", priority,
              allow_platform_fallback as "allowPlatformFallback",
              health_status as "healthStatus", in_fallback_chain as "inFallbackChain"
       FROM user_ai_credentials WHERE id = $1`,
      [credentialId]
    );

    await client.query("COMMIT");
    return result[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function reorderChain(userId, orderedIds) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT id FROM user_ai_credentials WHERE user_id = $1`,
      [userId]
    );
    const existingIds = new Set(rows.map((r) => r.id));
    if (orderedIds.length !== rows.length) {
      const err = new Error("orderedIds must include all credentials for this user");
      err.code = "INVALID_CHAIN_ORDER";
      throw err;
    }
    for (const id of orderedIds) {
      if (!existingIds.has(id)) {
        const err = new Error("Invalid credential id in chain");
        err.code = "INVALID_CHAIN_ORDER";
        throw err;
      }
    }
    await applyPriorities(client, userId, orderedIds);
    await client.query("COMMIT");
    return listByUser(userId);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function promoteToPrimary(credentialId, userId) {
  const rows = await listByUser(userId);
  const idx = rows.findIndex((r) => r.id === credentialId);
  if (idx < 0) return null;
  const orderedIds = [credentialId, ...rows.filter((r) => r.id !== credentialId).map((r) => r.id)];
  await reorderChain(userId, orderedIds);
  return getById(credentialId, userId);
}

async function setInFallbackChain(credentialId, userId, inFallbackChain) {
  const { rows } = await pool.query(
    `UPDATE user_ai_credentials
     SET in_fallback_chain = $3, updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING id, in_fallback_chain as "inFallbackChain"`,
    [credentialId, userId, !!inFallbackChain]
  );
  return rows[0] || null;
}

async function updateHealth(credentialId, userId, healthStatus, { allowTerminalClear = false } = {}) {
  const current = await getById(credentialId, userId);
  if (!current) return null;

  if (current.healthStatus === "invalid" && healthStatus === "healthy" && !allowTerminalClear) {
    return current;
  }

  const { rows } = await pool.query(
    `UPDATE user_ai_credentials
     SET health_status = $3, health_updated_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING health_status as "healthStatus", health_updated_at as "healthUpdatedAt"`,
    [credentialId, userId, healthStatus]
  );
  return rows[0] || null;
}

async function deleteCredential(id, userId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const row = await getById(id, userId);
    if (!row) {
      await client.query("ROLLBACK");
      return false;
    }

    await client.query(`DELETE FROM user_ai_credentials WHERE id = $1 AND user_id = $2`, [id, userId]);

    const { rows: remaining } = await client.query(
      `SELECT id FROM user_ai_credentials WHERE user_id = $1 ORDER BY priority ASC`,
      [userId]
    );

    if (remaining.length) {
      await applyPriorities(
        client,
        userId,
        remaining.map((r) => r.id)
      );
    }

    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function setActive(credentialId, userId) {
  return promoteToPrimary(credentialId, userId);
}

module.exports = {
  listByUser,
  getPrimaryByUser,
  getActiveByUser,
  getById,
  upsertCredential,
  reorderChain,
  promoteToPrimary,
  setInFallbackChain,
  updateHealth,
  deleteCredential,
  setActive,
  applyPriorities,
  PRIORITY_OFFSET,
};
