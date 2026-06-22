const { pool } = require("../db");

async function listUsersForAdmin({ search, aiMode, limit = 50, offset = 0, days = 30 }) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const params = [since, limit, offset];
  const conditions = ["1=1"];
  let idx = 4;

  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(
      `(u.email ILIKE $${idx} OR u.full_name ILIKE $${idx} OR u.id::text ILIKE $${idx})`
    );
    params.push(term);
    idx += 1;
  }

  if (aiMode === "managed") {
    conditions.push(`COALESCE(pl.slug, '') = 'managed'`);
  } else if (aiMode === "byok") {
    conditions.push(`(COALESCE(pl.slug, '') = 'byok' OR EXISTS (
      SELECT 1 FROM user_ai_credentials uac WHERE uac.user_id = u.id
    ))`);
  }

  const where = conditions.join(" AND ");

  const { rows } = await pool.query(
    `SELECT
       u.id,
       u.email,
       u.full_name,
       u.is_blocked,
       u.blocked_reason,
       u.created_at,
       pl.slug AS plan_slug,
       CASE
         WHEN COALESCE(pl.slug, '') = 'managed' THEN 'managed'
         WHEN COALESCE(pl.slug, '') = 'byok' THEN 'byok'
         WHEN EXISTS (SELECT 1 FROM user_ai_credentials uac WHERE uac.user_id = u.id) THEN 'byok'
         ELSE 'none'
       END AS ai_mode,
       COALESCE(uc.usage_count, 0)::int AS applications_sent,
       COALESCE(costs.total_cost, 0)::numeric AS ai_cost,
       costs.primary_provider,
       costs.primary_model,
       COALESCE(admin_bonus.total, 0)::int AS admin_bonus_applications,
       COALESCE(referral_bonus.total, 0)::int AS referral_bonus_applications
     FROM users u
     LEFT JOIN user_subscriptions us
       ON us.user_id = u.id AND us.status IN ('trialing', 'active')
     LEFT JOIN plans pl ON pl.id = us.plan_id
     LEFT JOIN usage_counters uc
       ON uc.user_id = u.id
      AND uc.feature_key = 'quota_applications_sent'
      AND uc.period_type = 'lifetime'
      AND uc.period_start = '1970-01-01'
     LEFT JOIN LATERAL (
       SELECT
         COALESCE(SUM(l.estimated_cost), 0) AS total_cost,
         (ARRAY_AGG(l.provider ORDER BY l.estimated_cost DESC NULLS LAST))[1] AS primary_provider,
         (ARRAY_AGG(l.model ORDER BY l.estimated_cost DESC NULLS LAST))[1] AS primary_model
       FROM llm_usage_logs l
       WHERE l.user_id = u.id AND l.created_at >= $1
     ) costs ON TRUE
     LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(applications_granted), 0) AS total
       FROM admin_application_grants g WHERE g.user_id = u.id
     ) admin_bonus ON TRUE
     LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(applications_granted), 0) AS total
       FROM referral_rewards r WHERE r.referrer_user_id = u.id
     ) referral_bonus ON TRUE
     WHERE ${where}
     ORDER BY costs.total_cost DESC NULLS LAST, u.created_at DESC
     LIMIT $2 OFFSET $3`,
    params
  );

  const countParams = [];
  let countParamIdx = 1;
  const countConditions = ["1=1"];
  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    countConditions.push(
      `(u.email ILIKE $${countParamIdx} OR u.full_name ILIKE $${countParamIdx} OR u.id::text ILIKE $${countParamIdx})`
    );
    countParams.push(term);
    countParamIdx += 1;
  }
  if (aiMode === "managed") {
    countConditions.push(`COALESCE(pl.slug, '') = 'managed'`);
  } else if (aiMode === "byok") {
    countConditions.push(`(COALESCE(pl.slug, '') = 'byok' OR EXISTS (
      SELECT 1 FROM user_ai_credentials uac WHERE uac.user_id = u.id
    ))`);
  }

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM users u
     LEFT JOIN user_subscriptions us
       ON us.user_id = u.id AND us.status IN ('trialing', 'active')
     LEFT JOIN plans pl ON pl.id = us.plan_id
     WHERE ${countConditions.join(" AND ")}`,
    countParams
  );

  return { rows, total: Number(countRows[0]?.total || 0) };
}

async function setUserBlocked(userId, { blocked, reason, blockedAt }) {
  const { rows } = await pool.query(
    `UPDATE users
     SET is_blocked = $2,
         blocked_reason = $3,
         blocked_at = $4
     WHERE id = $1
     RETURNING id, email, is_blocked, blocked_reason, blocked_at`,
    [userId, blocked, reason || null, blockedAt || null]
  );
  return rows[0] || null;
}

async function grantApplications(userId, { applicationsGranted, grantedBy, note }) {
  const { rows } = await pool.query(
    `INSERT INTO admin_application_grants (user_id, applications_granted, granted_by, note)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, applicationsGranted, grantedBy || null, note || null]
  );
  return rows[0];
}

async function getAdminBonusTotal(userId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(applications_granted), 0)::int AS total
     FROM admin_application_grants WHERE user_id = $1`,
    [userId]
  );
  return Number(rows[0]?.total || 0);
}

module.exports = {
  listUsersForAdmin,
  setUserBlocked,
  grantApplications,
  getAdminBonusTotal,
};
