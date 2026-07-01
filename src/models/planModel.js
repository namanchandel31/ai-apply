const { pool } = require("../db");

function mapPlan(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    description: row.description,
    tier: row.tier,
    isActive: row.is_active,
    isArchived: row.is_archived,
    sortOrder: row.sort_order,
    popular: row.popular,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPricePoint(row) {
  if (!row) return null;
  return {
    id: row.id,
    planId: row.plan_id,
    label: row.label,
    durationDays: row.duration_days,
    amountPaise: row.amount_paise,
    currency: row.currency,
    isActive: row.is_active,
    interval: row.interval,
    sortOrder: row.sort_order ?? 0,
    razorpayPlanId: row.razorpay_plan_id,
  };
}

const PLAN_COLUMNS = `id, slug, display_name, description, tier, is_active,
                      is_archived, sort_order, popular, metadata, created_at, updated_at`;

async function listPlans({ activeOnly = false } = {}) {
  const { rows } = await pool.query(
    `SELECT ${PLAN_COLUMNS} FROM plans
     ${activeOnly ? "WHERE is_active = TRUE AND is_archived = FALSE" : ""}
     ORDER BY sort_order, created_at`
  );
  return rows.map(mapPlan);
}

async function getPlanById(id) {
  const { rows } = await pool.query(
    `SELECT ${PLAN_COLUMNS} FROM plans WHERE id = $1 LIMIT 1`, [id]
  );
  return mapPlan(rows[0]);
}

async function getPlanBySlug(slug) {
  const { rows } = await pool.query(
    `SELECT ${PLAN_COLUMNS} FROM plans WHERE slug = $1 LIMIT 1`, [slug]
  );
  return mapPlan(rows[0]);
}

async function createPlan({
  slug,
  displayName,
  description,
  tier,
  sortOrder = 0,
  popular = false,
  isActive = true,
  metadata = {},
}) {
  const { rows } = await pool.query(
    `INSERT INTO plans (slug, display_name, description, tier, sort_order, popular, is_active, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     RETURNING ${PLAN_COLUMNS}`,
    [slug, displayName, description ?? null, tier ?? null, sortOrder, popular, isActive, JSON.stringify(metadata)]
  );
  return mapPlan(rows[0]);
}

async function updatePlan(id, fields) {
  const map = {
    displayName: "display_name",
    description: "description",
    tier: "tier",
    isActive: "is_active",
    isArchived: "is_archived",
    sortOrder: "sort_order",
    popular: "popular",
  };
  const sets = [];
  const values = [];
  let i = 1;
  for (const [k, col] of Object.entries(map)) {
    if (fields[k] === undefined) continue;
    sets.push(`${col} = $${i}`);
    values.push(fields[k]);
    i += 1;
  }
  if (fields.metadata !== undefined) {
    sets.push(`metadata = $${i}::jsonb`);
    values.push(JSON.stringify(fields.metadata));
    i += 1;
  }
  if (!sets.length) return getPlanById(id);
  sets.push("updated_at = NOW()");
  values.push(id);
  const { rows } = await pool.query(
    `UPDATE plans SET ${sets.join(", ")} WHERE id = $${i} RETURNING ${PLAN_COLUMNS}`, values
  );
  return mapPlan(rows[0]);
}

// ----- Price points -----
async function listPricePoints(planId, { activeOnly = false } = {}) {
  const { rows } = await pool.query(
    `SELECT * FROM plan_price_points WHERE plan_id = $1
     ${activeOnly ? "AND is_active = TRUE" : ""} ORDER BY sort_order, duration_days, amount_paise`,
    [planId]
  );
  return rows.map(mapPricePoint);
}

async function getPricePointById(id) {
  const { rows } = await pool.query(
    `SELECT * FROM plan_price_points WHERE id = $1 LIMIT 1`, [id]
  );
  return mapPricePoint(rows[0]);
}

async function createPricePoint({
  planId,
  label,
  durationDays,
  amountPaise,
  currency = "INR",
  interval = null,
  isActive = true,
  sortOrder = 0,
}) {
  const { rows } = await pool.query(
    `INSERT INTO plan_price_points (plan_id, label, duration_days, amount_paise, currency, interval, is_active, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [planId, label ?? null, durationDays, amountPaise, currency, interval, isActive, sortOrder]
  );
  return mapPricePoint(rows[0]);
}

async function updatePricePoint(id, fields, planId = null) {
  const map = {
    label: "label",
    durationDays: "duration_days",
    amountPaise: "amount_paise",
    currency: "currency",
    interval: "interval",
    isActive: "is_active",
    sortOrder: "sort_order",
  };
  const sets = [];
  const values = [];
  let i = 1;
  for (const [k, col] of Object.entries(map)) {
    if (fields[k] === undefined) continue;
    sets.push(`${col} = $${i}`);
    values.push(fields[k]);
    i += 1;
  }
  if (!sets.length) return getPricePointById(id);
  sets.push("updated_at = NOW()");
  values.push(id);
  let where = `id = $${i}`;
  if (planId) {
    i += 1;
    values.push(planId);
    where += ` AND plan_id = $${i}`;
  }
  const { rows } = await pool.query(
    `UPDATE plan_price_points SET ${sets.join(", ")} WHERE ${where} RETURNING *`,
    values
  );
  return mapPricePoint(rows[0]);
}

// ----- Marketing features -----
async function listPlanFeatures(planId) {
  const { rows } = await pool.query(
    `SELECT pf.id, pf.label, pf.included, pf.sort_order, pf.feature_id, fd.key AS feature_key
     FROM plan_features pf
     LEFT JOIN feature_definitions fd ON fd.id = pf.feature_id
     WHERE pf.plan_id = $1 ORDER BY pf.sort_order`,
    [planId]
  );
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    included: r.included,
    sortOrder: r.sort_order,
    featureId: r.feature_id,
    featureKey: r.feature_key ?? null,
  }));
}

async function replacePlanFeatures(planId, features) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM plan_features WHERE plan_id = $1`, [planId]);
    let order = 0;
    for (const f of features) {
      let featureId = f.featureId ?? null;
      if (!featureId && f.featureKey) {
        const { rows } = await client.query(
          `SELECT id FROM feature_definitions WHERE key = $1 LIMIT 1`,
          [f.featureKey]
        );
        featureId = rows[0]?.id ?? null;
      }
      await client.query(
        `INSERT INTO plan_features (plan_id, feature_id, label, included, sort_order)
         VALUES ($1, $2, $3, $4, $5)`,
        [planId, featureId, f.label, f.included !== false, f.sortOrder ?? order]
      );
      order += 1;
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return listPlanFeatures(planId);
}

// ----- Entitlements (catalog-referenced rows) -----
/** Returns entitlement rows joined to the catalog for a plan. */
async function listPlanEntitlements(planId) {
  const { rows } = await pool.query(
    `SELECT pe.id, pe.feature_id, pe.value, fd.key, fd.type, fd.display_name, fd.default_value
     FROM plan_entitlements pe
     JOIN feature_definitions fd ON fd.id = pe.feature_id
     WHERE pe.plan_id = $1
     ORDER BY fd.category NULLS LAST, fd.key`,
    [planId]
  );
  return rows.map((r) => ({
    id: r.id,
    featureId: r.feature_id,
    key: r.key,
    type: r.type,
    displayName: r.display_name,
    value: r.value,
  }));
}

async function upsertPlanEntitlement(planId, featureId, value, updatedBy = null) {
  const { rows } = await pool.query(
    `INSERT INTO plan_entitlements (plan_id, feature_id, value, updated_by, updated_at)
     VALUES ($1, $2, $3::jsonb, $4, NOW())
     ON CONFLICT (plan_id, feature_id) DO UPDATE SET
       value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()
     RETURNING id, feature_id, value`,
    [planId, featureId, JSON.stringify(value), updatedBy]
  );
  return rows[0];
}

async function deletePlanEntitlement(planId, featureId) {
  await pool.query(
    `DELETE FROM plan_entitlements WHERE plan_id = $1 AND feature_id = $2`,
    [planId, featureId]
  );
}

/**
 * Resolved flat entitlement map for a plan: every active catalog feature's value,
 * using the plan's override when present else the catalog default_value.
 */
async function resolveEntitlementMap(planId) {
  const { rows } = await pool.query(
    `SELECT fd.key, fd.default_value, pe.value
     FROM feature_definitions fd
     LEFT JOIN plan_entitlements pe
       ON pe.feature_id = fd.id AND pe.plan_id = $1
     WHERE fd.is_active = TRUE`,
    [planId]
  );
  const map = {};
  for (const r of rows) {
    map[r.key] = r.value !== null && r.value !== undefined ? r.value : r.default_value;
  }
  return map;
}

/** Catalog defaults only (used when paywall disabled / no active plan). */
async function resolveDefaultEntitlementMap() {
  const { rows } = await pool.query(
    `SELECT key, default_value FROM feature_definitions WHERE is_active = TRUE`
  );
  const map = {};
  for (const r of rows) map[r.key] = r.default_value;
  return map;
}

// ----- Onboarding flows -----
async function getOnboardingFlow(planId) {
  const { rows } = await pool.query(
    `SELECT steps FROM onboarding_flows WHERE plan_id = $1 LIMIT 1`, [planId]
  );
  return rows.length ? rows[0].steps : null;
}

async function upsertOnboardingFlow(planId, steps, updatedBy = null) {
  const { rows } = await pool.query(
    `INSERT INTO onboarding_flows (plan_id, steps, updated_by, updated_at)
     VALUES ($1, $2::jsonb, $3, NOW())
     ON CONFLICT (plan_id) DO UPDATE SET
       steps = EXCLUDED.steps, updated_by = EXCLUDED.updated_by, updated_at = NOW()
     RETURNING steps`,
    [planId, JSON.stringify(steps), updatedBy]
  );
  return rows[0].steps;
}

module.exports = {
  mapPlan,
  listPlans,
  getPlanById,
  getPlanBySlug,
  createPlan,
  updatePlan,
  listPricePoints,
  getPricePointById,
  createPricePoint,
  updatePricePoint,
  listPlanFeatures,
  replacePlanFeatures,
  listPlanEntitlements,
  upsertPlanEntitlement,
  deletePlanEntitlement,
  resolveEntitlementMap,
  resolveDefaultEntitlementMap,
  getOnboardingFlow,
  upsertOnboardingFlow,
};
