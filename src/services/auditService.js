const auditLogModel = require("../models/auditLogModel");
const { logError } = require("../utils/logger");

/**
 * Records an admin mutation. Best-effort: an audit failure must never block the
 * primary action, but it is logged.
 */
async function record({ req, action, entityType, entityId = null, before = null, after = null }) {
  try {
    const actorUserId = req?.user?.id ?? null;
    const ip = req?.headers?.["x-forwarded-for"] || req?.ip || null;
    return await auditLogModel.recordAudit({ actorUserId, action, entityType, entityId, before, after, ip });
  } catch (err) {
    logError("AUDIT_RECORD_FAILED", err, { action, entityType, entityId });
    return null;
  }
}

module.exports = { record, list: auditLogModel.listAudit };
