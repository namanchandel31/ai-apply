const { pool } = require("../db");

async function recordAudit({ actorUserId, action, entityType, entityId = null, before = null, after = null, ip = null }) {
  const { rows } = await pool.query(
    `INSERT INTO admin_audit_logs (actor_user_id, action, entity_type, entity_id, before, after, ip)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
     RETURNING id, created_at`,
    [
      actorUserId ?? null,
      action,
      entityType,
      entityId,
      before === null ? null : JSON.stringify(before),
      after === null ? null : JSON.stringify(after),
      ip,
    ]
  );
  return rows[0];
}

async function listAudit({ entityType = null, limit = 100, offset = 0 } = {}) {
  const { rows } = await pool.query(
    `SELECT id, actor_user_id, action, entity_type, entity_id, before, after, ip, created_at
     FROM admin_audit_logs
     ${entityType ? "WHERE entity_type = $3" : ""}
     ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    entityType ? [limit, offset, entityType] : [limit, offset]
  );
  return rows;
}

module.exports = { recordAudit, listAudit };
