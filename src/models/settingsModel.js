const { pool } = require("../db");

/** Returns all settings as a flat { key: value } map (values are parsed JSON). */
async function getAllSettings() {
  const { rows } = await pool.query(`SELECT key, value FROM app_settings`);
  const out = {};
  for (const row of rows) out[row.key] = row.value;
  return out;
}

async function getSetting(key) {
  const { rows } = await pool.query(
    `SELECT value FROM app_settings WHERE key = $1 LIMIT 1`,
    [key]
  );
  return rows.length ? rows[0].value : undefined;
}

async function upsertSetting(key, value, updatedBy = null) {
  const { rows } = await pool.query(
    `INSERT INTO app_settings (key, value, updated_by, updated_at)
     VALUES ($1, $2::jsonb, $3, NOW())
     ON CONFLICT (key) DO UPDATE SET
       value = EXCLUDED.value,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()
     RETURNING key, value`,
    [key, JSON.stringify(value), updatedBy]
  );
  return rows[0];
}

module.exports = { getAllSettings, getSetting, upsertSetting };
