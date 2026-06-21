const { pool } = require("../db");

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    key: row.key,
    displayName: row.display_name,
    description: row.description,
    type: row.type,
    defaultValue: row.default_value,
    enumOptions: row.enum_options,
    category: row.category,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const COLUMNS = `id, key, display_name, description, type, default_value,
                 enum_options, category, is_active, created_at, updated_at`;

async function listFeatures({ includeInactive = true } = {}) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM feature_definitions
     ${includeInactive ? "" : "WHERE is_active = TRUE"}
     ORDER BY category NULLS LAST, key`
  );
  return rows.map(mapRow);
}

async function getFeatureByKey(key) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM feature_definitions WHERE key = $1 LIMIT 1`,
    [key]
  );
  return mapRow(rows[0]);
}

async function getFeatureById(id) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM feature_definitions WHERE id = $1 LIMIT 1`,
    [id]
  );
  return mapRow(rows[0]);
}

async function createFeature({ key, displayName, description, type, defaultValue, enumOptions, category }) {
  const { rows } = await pool.query(
    `INSERT INTO feature_definitions
      (key, display_name, description, type, default_value, enum_options, category)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
     RETURNING ${COLUMNS}`,
    [
      key,
      displayName,
      description ?? null,
      type,
      defaultValue === undefined ? null : JSON.stringify(defaultValue),
      enumOptions === undefined ? null : JSON.stringify(enumOptions),
      category ?? null,
    ]
  );
  return mapRow(rows[0]);
}

/** Editable fields only — key and type are immutable once created. */
async function updateFeature(id, { displayName, description, defaultValue, enumOptions, category, isActive }) {
  const sets = [];
  const values = [];
  let i = 1;
  const push = (col, val, isJson = false) => {
    sets.push(`${col} = $${i}${isJson ? "::jsonb" : ""}`);
    values.push(isJson ? JSON.stringify(val) : val);
    i += 1;
  };
  if (displayName !== undefined) push("display_name", displayName);
  if (description !== undefined) push("description", description);
  if (defaultValue !== undefined) push("default_value", defaultValue, true);
  if (enumOptions !== undefined) push("enum_options", enumOptions, true);
  if (category !== undefined) push("category", category);
  if (isActive !== undefined) push("is_active", isActive);
  if (!sets.length) return getFeatureById(id);
  sets.push("updated_at = NOW()");
  values.push(id);
  const { rows } = await pool.query(
    `UPDATE feature_definitions SET ${sets.join(", ")} WHERE id = $${i} RETURNING ${COLUMNS}`,
    values
  );
  return mapRow(rows[0]);
}

module.exports = {
  listFeatures,
  getFeatureByKey,
  getFeatureById,
  createFeature,
  updateFeature,
};
