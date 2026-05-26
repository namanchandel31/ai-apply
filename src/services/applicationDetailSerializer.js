const { serializeApplication } = require("./applicationSerializer");
const { mapJobsFromListRow } = require("./applicationListSerializer");

const LLM_RAW_OUTPUT_MAX_CHARS = 32 * 1024;

function truncateField(value, maxChars = LLM_RAW_OUTPUT_MAX_CHARS) {
  if (value == null || typeof value !== "string") return { value, truncated: false };
  if (value.length <= maxChars) return { value, truncated: false };
  return { value: value.slice(0, maxChars), truncated: true };
}

function parseJsonField(val) {
  if (val == null) return null;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}

/**
 * Full detail payload for modal — includes heavy fields with size guards.
 */
function serializeApplicationDetail(row) {
  const jobs = mapJobsFromListRow(row);
  const base = serializeApplication(row, jobs);
  const llm = truncateField(row.llm_raw_output);

  return {
    ...base,
    matchScore: row.match_score ?? null,
    emailSubject: row.email_subject ?? null,
    emailBody: row.email_body ?? null,
    error: row.error ?? null,
    lastError: row.last_error ?? null,
    llmRawOutput: llm.value,
    llmRawOutputTruncated: llm.truncated,
    smtpMessageId: row.smtp_message_id ?? null,
    providerMessageId: row.provider_message_id ?? null,
    orchestrationVersion: Number(row.orchestration_version ?? 0),
    orchestrationEpoch: Number(row.orchestration_epoch ?? 0),
    processingAttempts: row.processing_attempts ?? null,
    failureStage: row.failure_stage ?? null,
    recipientEmail: row.recipient_email ?? null,
    normalizedJobTitle: row.normalized_job_title ?? null,
    normalizedCompanyName: row.normalized_company_name ?? null,
    parsedJdSnapshot: parseJsonField(row.parsed_jd_snapshot),
    parsedResumeSnapshot: parseJsonField(row.parsed_resume_snapshot),
    emailMetadata: parseJsonField(row.email_metadata),
    emailFeedbackSignals: parseJsonField(row.email_feedback_signals),
    failedAt: row.failed_at ?? null,
  };
}

module.exports = {
  serializeApplicationDetail,
  truncateField,
  LLM_RAW_OUTPUT_MAX_CHARS,
};
