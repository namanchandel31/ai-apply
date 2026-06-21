const { pool } = require("../db");

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    type: row.type,
    enabled: row.enabled,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    userLimit: row.user_limit,
    claimedCount: row.claimed_count,
    trialDays: row.trial_days,
    discountType: row.discount_type,
    discountAmount: row.discount_amount,
    applicablePlanIds: row.applicable_plan_ids || [],
    priority: row.priority,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const COLUMNS = `id, name, code, type, enabled, starts_at, ends_at, user_limit,
                 claimed_count, trial_days, discount_type, discount_amount,
                 applicable_plan_ids, priority, metadata, created_at, updated_at`;

async function listCampaigns({ enabledOnly = false } = {}) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM campaigns
     ${enabledOnly ? "WHERE enabled = TRUE" : ""}
     ORDER BY priority DESC, created_at DESC`
  );
  return rows.map(mapRow);
}

async function getById(id, client = pool) {
  const { rows } = await client.query(`SELECT ${COLUMNS} FROM campaigns WHERE id = $1 LIMIT 1`, [id]);
  return mapRow(rows[0]);
}

async function getByCode(code, client = pool) {
  const { rows } = await client.query(`SELECT ${COLUMNS} FROM campaigns WHERE code = $1 LIMIT 1`, [code]);
  return mapRow(rows[0]);
}

async function createCampaign(fields) {
  const { rows } = await pool.query(
    `INSERT INTO campaigns
      (name, code, type, enabled, starts_at, ends_at, user_limit, trial_days,
       discount_type, discount_amount, applicable_plan_ids, priority, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
     RETURNING ${COLUMNS}`,
    [
      fields.name,
      fields.code ?? null,
      fields.type,
      fields.enabled ?? false,
      fields.startsAt ?? null,
      fields.endsAt ?? null,
      fields.userLimit ?? null,
      fields.trialDays ?? null,
      fields.discountType ?? null,
      fields.discountAmount ?? null,
      fields.applicablePlanIds ?? [],
      fields.priority ?? 0,
      JSON.stringify(fields.metadata ?? {}),
    ]
  );
  return mapRow(rows[0]);
}

async function updateCampaign(id, fields) {
  const map = {
    name: "name",
    code: "code",
    type: "type",
    enabled: "enabled",
    startsAt: "starts_at",
    endsAt: "ends_at",
    userLimit: "user_limit",
    trialDays: "trial_days",
    discountType: "discount_type",
    discountAmount: "discount_amount",
    applicablePlanIds: "applicable_plan_ids",
    priority: "priority",
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
  if (!sets.length) return getById(id);
  sets.push("updated_at = NOW()");
  values.push(id);
  const { rows } = await pool.query(
    `UPDATE campaigns SET ${sets.join(", ")} WHERE id = $${i} RETURNING ${COLUMNS}`, values
  );
  return mapRow(rows[0]);
}

async function getRedemption(campaignId, userId, client = pool) {
  const { rows } = await client.query(
    `SELECT id FROM campaign_redemptions WHERE campaign_id = $1 AND user_id = $2 LIMIT 1`,
    [campaignId, userId]
  );
  return rows[0] || null;
}

module.exports = {
  mapRow,
  listCampaigns,
  getById,
  getByCode,
  createCampaign,
  updateCampaign,
  getRedemption,
};
