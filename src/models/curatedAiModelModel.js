const { pool } = require("../db");

async function listCuratedForAdmin() {
  const { rows } = await pool.query(
    `SELECT * FROM curated_ai_models ORDER BY overall_score DESC, sort_order ASC, created_at DESC`
  );
  return rows;
}

async function listActiveByProvider(provider) {
  const { rows } = await pool.query(
    `SELECT provider, model_id, display_name, overall_score, sort_order
     FROM curated_ai_models
     WHERE is_active = true AND provider = $1
     ORDER BY overall_score DESC, sort_order ASC`,
    [provider]
  );
  return rows;
}

async function listAllActive() {
  const { rows } = await pool.query(
    `SELECT provider, model_id, display_name, overall_score, sort_order
     FROM curated_ai_models
     WHERE is_active = true
     ORDER BY provider, overall_score DESC, sort_order ASC`
  );
  return rows;
}

async function isModelAllowed(provider, modelId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM curated_ai_models
     WHERE provider = $1 AND model_id = $2 AND is_active = true
     LIMIT 1`,
    [provider, modelId]
  );
  return rows.length > 0;
}

async function hasAnyActiveForProvider(provider) {
  const { rows } = await pool.query(
    `SELECT 1 FROM curated_ai_models WHERE provider = $1 AND is_active = true LIMIT 1`,
    [provider]
  );
  return rows.length > 0;
}

async function promoteFromRun({ run, displayName, userId }) {
  const { rows } = await pool.query(
    `INSERT INTO curated_ai_models (
      provider, model_id, display_name,
      certification_score, reliability_score, value_score, overall_score,
      certification_run_id, is_active, sort_order, promoted_by_user_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10)
    ON CONFLICT (provider, model_id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      certification_score = EXCLUDED.certification_score,
      reliability_score = EXCLUDED.reliability_score,
      value_score = EXCLUDED.value_score,
      overall_score = EXCLUDED.overall_score,
      certification_run_id = EXCLUDED.certification_run_id,
      is_active = true,
      promoted_by_user_id = EXCLUDED.promoted_by_user_id
    RETURNING *`,
    [
      run.provider,
      run.model,
      displayName || run.model,
      run.certification_score,
      run.reliability_score,
      run.value_score,
      run.overall_score,
      run.id,
      -run.overall_score,
      userId,
    ]
  );
  return rows[0];
}

async function updateCurated(id, { isActive, sortOrder }) {
  const sets = [];
  const vals = [];
  let i = 1;
  if (typeof isActive === "boolean") {
    sets.push(`is_active = $${i++}`);
    vals.push(isActive);
  }
  if (typeof sortOrder === "number") {
    sets.push(`sort_order = $${i++}`);
    vals.push(sortOrder);
  }
  if (!sets.length) return null;
  vals.push(id);
  const { rows } = await pool.query(
    `UPDATE curated_ai_models SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
    vals
  );
  return rows[0] || null;
}

async function deactivateCurated(id) {
  const { rows } = await pool.query(
    `UPDATE curated_ai_models SET is_active = false WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

module.exports = {
  listCuratedForAdmin,
  listActiveByProvider,
  listAllActive,
  isModelAllowed,
  hasAnyActiveForProvider,
  promoteFromRun,
  updateCurated,
  deactivateCurated,
};
