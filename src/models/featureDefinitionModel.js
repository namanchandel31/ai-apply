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
    showInPlanPicker: row.show_in_plan_picker ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const COLUMNS = `id, key, display_name, description, type, default_value,
                 enum_options, category, is_active, show_in_plan_picker, created_at, updated_at`;

async function listFeatures({ includeInactive = true, pickerOnly = false } = {}) {
  const clauses = [];
  if (!includeInactive) clauses.push("is_active = TRUE");
  if (pickerOnly) clauses.push("show_in_plan_picker = TRUE");
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM feature_definitions
     ${where}
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

async function createFeature({
  key,
  displayName,
  description,
  type,
  defaultValue,
  enumOptions,
  category,
  showInPlanPicker = false,
}) {
  const { rows } = await pool.query(
    `INSERT INTO feature_definitions
      (key, display_name, description, type, default_value, enum_options, category, show_in_plan_picker)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
     RETURNING ${COLUMNS}`,
    [
      key,
      displayName,
      description ?? null,
      type,
      defaultValue === undefined ? null : JSON.stringify(defaultValue),
      enumOptions === undefined ? null : JSON.stringify(enumOptions),
      category ?? null,
      showInPlanPicker,
    ]
  );
  return mapRow(rows[0]);
}

/** Editable fields only — key and type are immutable once created. */
async function updateFeature(id, {
  displayName,
  description,
  defaultValue,
  enumOptions,
  category,
  isActive,
  showInPlanPicker,
}) {
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
  if (showInPlanPicker !== undefined) push("show_in_plan_picker", showInPlanPicker);
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
