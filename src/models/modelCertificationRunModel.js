const { pool } = require("../db");

async function createRun({
  userId,
  provider,
  model,
  resumeSource,
  certificationScore,
  reliabilityScore,
  valueScore,
  overallScore,
  passed,
  recommended,
  scoresJson,
  providerResponseMetadata,
  errorMessage,
}) {
  const { rows } = await pool.query(
    `INSERT INTO model_certification_runs (
      user_id, provider, model, resume_source,
      certification_score, reliability_score, value_score, overall_score,
      passed, recommended, scores_json, provider_response_metadata, error_message
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    RETURNING *`,
    [
      userId,
      provider,
      model,
      resumeSource,
      certificationScore,
      reliabilityScore,
      valueScore,
      overallScore,
      passed,
      recommended,
      JSON.stringify(scoresJson || {}),
      JSON.stringify(providerResponseMetadata || {}),
      errorMessage,
    ]
  );
  return rows[0];
}

async function listRunsForUser(userId, { limit = 50, offset = 0 } = {}) {
  const { rows } = await pool.query(
    `SELECT id, provider, model, resume_source, certification_score, reliability_score,
            value_score, overall_score, passed, recommended, scores_json, error_message, created_at
     FROM model_certification_runs
     WHERE user_id = $1
     ORDER BY overall_score DESC, created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return rows;
}

async function getRunById(id, userId) {
  const { rows } = await pool.query(
    `SELECT * FROM model_certification_runs WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return rows[0] || null;
}

module.exports = {
  createRun,
  listRunsForUser,
  getRunById,
};
