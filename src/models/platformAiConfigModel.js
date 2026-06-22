const { pool } = require("../db");

async function listCredentials() {
  const { rows } = await pool.query(
    `SELECT id, provider, label, is_active, traffic_weight, created_at, updated_at
     FROM platform_ai_credentials
     ORDER BY provider ASC, created_at ASC`
  );
  return rows;
}

async function getCredentialById(id) {
  const { rows } = await pool.query(`SELECT * FROM platform_ai_credentials WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function listActiveCredentialsForProvider(provider) {
  const { rows } = await pool.query(
    `SELECT * FROM platform_ai_credentials
     WHERE provider = $1 AND is_active = TRUE AND traffic_weight > 0
     ORDER BY created_at ASC`,
    [provider]
  );
  return rows;
}

async function createCredential({ provider, label, encryptedApiKey, isActive = true, trafficWeight = 100 }) {
  const { rows } = await pool.query(
    `INSERT INTO platform_ai_credentials
       (provider, label, encrypted_api_key, is_active, traffic_weight, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING id, provider, label, is_active, traffic_weight, created_at, updated_at`,
    [provider, label || null, encryptedApiKey, isActive, trafficWeight]
  );
  return rows[0];
}

async function deleteCredential(id) {
  const { rows } = await pool.query(
    `DELETE FROM platform_ai_credentials WHERE id = $1
     RETURNING id, provider, label, is_active, traffic_weight, created_at, updated_at`,
    [id]
  );
  return rows[0] || null;
}

async function updateCredential(id, { label, encryptedApiKey, isActive, trafficWeight }) {
  const sets = ["updated_at = NOW()"];
  const params = [id];
  let idx = 2;
  if (label !== undefined) {
    sets.push(`label = $${idx++}`);
    params.push(label);
  }
  if (encryptedApiKey !== undefined) {
    sets.push(`encrypted_api_key = $${idx++}`);
    params.push(encryptedApiKey);
  }
  if (isActive !== undefined) {
    sets.push(`is_active = $${idx++}`);
    params.push(isActive);
  }
  if (trafficWeight !== undefined) {
    sets.push(`traffic_weight = $${idx++}`);
    params.push(trafficWeight);
  }
  const { rows } = await pool.query(
    `UPDATE platform_ai_credentials SET ${sets.join(", ")} WHERE id = $1
     RETURNING id, provider, label, is_active, traffic_weight, created_at, updated_at`,
    params
  );
  return rows[0] || null;
}

async function getGlobalConfig() {
  const { rows } = await pool.query(
    `SELECT gc.*,
            cm.provider AS model_provider,
            cm.model_id,
            cm.display_name AS model_display_name,
            cm.is_active AS model_is_active,
            cm.certification_status
     FROM platform_ai_global_config gc
     JOIN curated_ai_models cm ON cm.id = gc.certified_model_id
     WHERE gc.id = 1`
  );
  return rows[0] || null;
}

async function upsertGlobalConfig({ certifiedModelId, isEnabled, updatedBy }) {
  const { rows } = await pool.query(
    `INSERT INTO platform_ai_global_config (id, certified_model_id, is_enabled, updated_by, updated_at)
     VALUES (1, $1, $2, $3, NOW())
     ON CONFLICT (id) DO UPDATE SET
       certified_model_id = EXCLUDED.certified_model_id,
       is_enabled = EXCLUDED.is_enabled,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()
     RETURNING *`,
    [certifiedModelId, isEnabled, updatedBy || null]
  );
  return rows[0];
}

async function usesCertifiedModel(certifiedModelId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM platform_ai_global_config WHERE certified_model_id = $1 AND is_enabled = TRUE LIMIT 1`,
    [certifiedModelId]
  );
  return rows.length > 0;
}

function pickWeightedCredential(credentials) {
  const active = credentials.filter((c) => c.is_active && Number(c.traffic_weight) > 0);
  if (!active.length) return null;
  const total = active.reduce((sum, c) => sum + Number(c.traffic_weight), 0);
  if (total <= 0) return active[0];
  let roll = Math.random() * total;
  for (const cred of active) {
    roll -= Number(cred.traffic_weight);
    if (roll <= 0) return cred;
  }
  return active[active.length - 1];
}

module.exports = {
  listCredentials,
  getCredentialById,
  listActiveCredentialsForProvider,
  createCredential,
  deleteCredential,
  updateCredential,
  getGlobalConfig,
  upsertGlobalConfig,
  usesCertifiedModel,
  pickWeightedCredential,
};
