const { serializeApplication } = require("./applicationSerializer");

function mapJobsFromListRow(row) {
  const processJob = row.process_job_id
    ? {
        id: row.process_job_id,
        application_id: row.id,
        job_type: "ai_process",
        status: row.process_job_status,
        created_at: row.process_job_created_at,
        updated_at: row.process_job_updated_at,
        last_error: row.process_job_last_error,
        retry_count: row.process_job_retry_count,
      }
    : null;
  const sendJob = row.send_job_id
    ? {
        id: row.send_job_id,
        application_id: row.id,
        job_type: "send_email",
        status: row.send_job_status,
        created_at: row.send_job_created_at,
        updated_at: row.send_job_updated_at,
        last_error: row.send_job_last_error,
        retry_count: row.send_job_retry_count,
      }
    : null;
  return { processJob, sendJob };
}

/**
 * Lightweight list row — no email body, JSONB blobs, or llm_raw_output.
 */
function serializeApplicationListItem(row) {
  const jobs = mapJobsFromListRow(row);
  const base = serializeApplication(row, jobs);
  return {
    id: base.id,
    status: base.status,
    uiStatus: base.uiStatus,
    terminal: base.terminal,
    executionTerminal: base.executionTerminal,
    pollable: base.pollable,
    canRetry: base.canRetry,
    canContinue: base.canContinue,
    canSend: base.canSend,
    canSendNow: base.canSendNow,
    estimatedSendAt: base.estimatedSendAt,
    reviewReason: base.reviewReason,
    lastError: base.lastError,
    retryCount: base.retryCount,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
    sentAt: base.sentAt,
    completedAt: base.completedAt,
    role: base.role,
    company: base.company,
    matchScore: row.match_score ?? null,
    normalizedCompanyName: row.normalized_company_name ?? null,
    normalizedJobTitle: row.normalized_job_title ?? null,
    jdEnrichment: base.jdEnrichment,
    trackerStatusId: row.tracker_status_id ?? null,
    sourcePlatform: base.sourcePlatform ?? null,
  };
}

function serializeApplicationsListResult(rows, params) {
  const totalItems = rows.length ? Number(rows[0].total_count) : 0;
  const pageSize = params.pageSize;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1);
  return {
    items: rows.map(serializeApplicationListItem),
    totalItems,
    totalPages: totalItems === 0 ? 0 : totalPages,
    currentPage: params.page,
    pageSize,
  };
}

module.exports = {
  serializeApplicationListItem,
  serializeApplicationsListResult,
  mapJobsFromListRow,
};
