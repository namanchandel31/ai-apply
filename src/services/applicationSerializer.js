const { buildResolverContext } = require("../domain/applicationStatus/context/buildResolverContext");
const { resolveUiStatus } = require("../domain/applicationStatus/resolver/resolveUiStatus");

function deriveJdEnrichment(serialized) {
  const hasRole = Boolean(serialized.role && String(serialized.role).trim());
  const hasCompany = Boolean(serialized.company && String(serialized.company).trim());
  if (hasRole && hasCompany) return "complete";
  if (!serialized.terminal) return "pending";
  return undefined;
}

/**
 * Maps DB row + jobs to API shape. See resolveCapabilities for terminal/pollable semantics.
 * Workflow failed (application_status) vs execution failed (job row) — see failureSemantics.js.
 */
function serializeApplication(row, jobs = {}) {
  const ctx = buildResolverContext({
    applicationStatus: row.application_status,
    reviewReason: row.review_reason,
    latestProcessJob: jobs.processJob,
    latestSendJob: jobs.sendJob,
    retryCount: row.retry_count ?? 0,
    emailSubject: row.email_subject,
    emailBody: row.email_body,
  });
  const resolved = resolveUiStatus(ctx);

  const base = {
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
    role: row.role ?? row.jd_title ?? null,
    company: row.company ?? row.company_name ?? null,
    matchScore: row.match_score ?? null,
    emailSubject: row.email_subject,
    emailBody: row.email_body,
    trackerStatusId: row.tracker_status_id ?? null,
  };
  const jdEnrichment = deriveJdEnrichment(base);
  if (jdEnrichment) {
    base.jdEnrichment = jdEnrichment;
  }
  return base;
}

module.exports = { serializeApplication, deriveJdEnrichment };
