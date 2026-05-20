const { pool } = require("../db");
const { buildResolverContext } = require("../domain/applicationStatus/context/buildResolverContext");
const { resolveUiStatus } = require("../domain/applicationStatus/resolver/resolveUiStatus");

/**
 * Authoritative orchestration snapshot for client registry hydration.
 */
async function getActiveOrchestrationForUser(userId, client = pool) {
  const { rows } = await client.query(
    `SELECT id, application_status, review_reason, retry_count,
            orchestration_version, orchestration_epoch, updated_at
     FROM applications
     WHERE user_id = $1
     ORDER BY updated_at DESC`,
    [userId]
  );

  return rows.map((row) => {
    const ctx = buildResolverContext({
      applicationStatus: row.application_status,
      reviewReason: row.review_reason,
      latestProcessJob: null,
      latestSendJob: null,
      retryCount: row.retry_count ?? 0,
    });
    const resolved = resolveUiStatus(ctx);
    return {
      applicationId: row.id,
      version: Number(row.orchestration_version ?? 0),
      orchestrationEpoch: Number(row.orchestration_epoch ?? 0),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : "",
      terminal: resolved.terminal,
      pollable: resolved.pollable,
      uiStatus: resolved.uiStatus,
      status: row.application_status,
    };
  });
}

module.exports = { getActiveOrchestrationForUser };
