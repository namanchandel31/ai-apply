const { pool } = require("../db");

function mapRow(row) {
  if (!row) return null;
  return {
    hiringKeywords: row.hiring_keywords ?? [],
    applyKeywords: row.apply_keywords ?? [],
    blockedEmailPrefixes: row.blocked_email_prefixes ?? [],
    scoreEmail: row.score_email,
    scoreHiringKeyword: row.score_hiring_keyword,
    scoreApplyKeyword: row.score_apply_keyword,
    threshold: row.threshold,
    updatedAt: row.updated_at,
  };
}

async function getDetectionConfig() {
  const { rows } = await pool.query(
    `SELECT hiring_keywords, apply_keywords, blocked_email_prefixes,
            score_email, score_hiring_keyword, score_apply_keyword, threshold, updated_at
     FROM extension_detection_config WHERE id = 1`
  );
  return mapRow(rows[0]);
}

async function updateDetectionConfig(fields) {
  const sets = [];
  const values = [];
  let i = 1;

  const allowed = {
    hiringKeywords: "hiring_keywords",
    applyKeywords: "apply_keywords",
    blockedEmailPrefixes: "blocked_email_prefixes",
    scoreEmail: "score_email",
    scoreHiringKeyword: "score_hiring_keyword",
    scoreApplyKeyword: "score_apply_keyword",
    threshold: "threshold",
  };

  for (const [key, column] of Object.entries(allowed)) {
    if (fields[key] === undefined) continue;
    const val = ["hiringKeywords", "applyKeywords", "blockedEmailPrefixes"].includes(key)
      ? JSON.stringify(fields[key])
      : fields[key];
    sets.push(`${column} = $${i}`);
    values.push(val);
    i += 1;
  }

  if (!sets.length) return getDetectionConfig();

  sets.push("updated_at = NOW()");
  const { rows } = await pool.query(
    `UPDATE extension_detection_config SET ${sets.join(", ")} WHERE id = 1
     RETURNING hiring_keywords, apply_keywords, blocked_email_prefixes,
               score_email, score_hiring_keyword, score_apply_keyword, threshold, updated_at`,
    values
  );
  return mapRow(rows[0]);
}

module.exports = {
  getDetectionConfig,
  updateDetectionConfig,
};
