const { buildResolverContext } = require("../domain/applicationStatus/context/buildResolverContext");
const { resolveUiStatus } = require("../domain/applicationStatus/resolver/resolveUiStatus");
const { isTerminalApplicationStatus } = require("./orchestrationVersion");

/**
 * Serialize status from applications-table snapshot only (no job laterals).
 */
function serializeApplicationFromSnapshot(row) {
  const ctx = buildResolverContext({
    applicationStatus: row.application_status,
    reviewReason: row.review_reason,
    latestProcessJob: null,
    latestSendJob: null,
    retryCount: row.retry_count ?? 0,
    emailSubject: row.email_subject,
    emailBody: row.email_body,
  });
  const resolved = resolveUiStatus(ctx);

  return {
    id: row.id,
    status: row.application_status,
    uiStatus: resolved.uiStatus,
    terminal: resolved.terminal,
    executionTerminal: resolved.terminal,
    pollable: resolved.pollable,
    canRetry: resolved.canRetry,
    canContinue: resolved.canContinue,
    canSend: resolved.canSend,
    reviewReason: row.review_reason,
    lastError: row.last_error,
    retryCount: row.retry_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sentAt: row.sent_at,
    completedAt: row.completed_at,
    matchScore: row.match_score ?? null,
    trackerStatusId: row.tracker_status_id ?? null,
  };
}

/**
 * Route status reads: terminal → snapshot fast path; active → full bundle.
 */
async function getApplicationStatusForPoll(applicationId, userId, models) {
  const { getApplicationStatusSnapshot, getApplicationStatusBundle } = models;

  const snapshot = await getApplicationStatusSnapshot(applicationId, userId);
  if (!snapshot) return null;

  if (isTerminalApplicationStatus(snapshot.application_status)) {
    return {
      fastPath: "terminal",
      row: snapshot,
      jobs: {},
      serialized: serializeApplicationFromSnapshot(snapshot),
    };
  }

  const bundle = await getApplicationStatusBundle(applicationId, userId);
  if (!bundle) return null;

  const { serializeApplication } = require("./applicationSerializer");
  return {
    fastPath: "active",
    row: bundle.row,
    jobs: bundle.jobs,
    bundleRow: bundle.bundleRow,
    serialized: serializeApplication(bundle.row, bundle.jobs),
  };
}

module.exports = {
  serializeApplicationFromSnapshot,
  getApplicationStatusForPoll,
};
