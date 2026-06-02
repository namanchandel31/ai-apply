const { pool, instrumentedQuery } = require("../db");
const { transitionApplicationState } = require("../services/transitionApplicationState");
const { APPLICATION_STATUS } = require("../domain/applicationStatus/constants/uiStatuses");

const getApplicationByResumeAndJD = async (resumeId, jobDescriptionId, userId = null, client = null) => {
  const queryClient = client || pool;
  const query = userId
    ? `SELECT a.*, r.file_path
       FROM applications a
       LEFT JOIN resumes r ON r.id = a.resume_id
       WHERE a.resume_id = $1 AND a.job_description_id = $2 AND a.user_id = $3
       LIMIT 1`
    : `SELECT a.*
       FROM applications a
       WHERE a.resume_id = $1 AND a.job_description_id = $2
       LIMIT 1`;

  const params = userId ? [resumeId, jobDescriptionId, userId] : [resumeId, jobDescriptionId];
  const { rows } = await queryClient.query(query, params);
  return rows[0] ?? null;
};

const {
  STATUS_BUNDLE_SQL,
  mapBundleRow,
  getApplicationStatusBundle,
  getApplicationStatusSnapshot,
} = require("../services/applicationStatusQueryService");

const getApplicationById = async (applicationId, userId = null, client = null) => {
  const queryClient = client || pool;
  const query = userId
    ? `SELECT a.*, jd.contact_email as jd_contact_email, jd.title as jd_title,
              jd.company_name, r.file_path
       FROM applications a
       JOIN job_descriptions jd ON jd.id = a.job_description_id
       LEFT JOIN resumes r ON r.id = a.resume_id
       WHERE a.id = $1 AND a.user_id = $2`
    : `SELECT a.*, jd.contact_email as jd_contact_email, jd.title as jd_title,
              jd.company_name, r.file_path
       FROM applications a
       JOIN job_descriptions jd ON jd.id = a.job_description_id
       LEFT JOIN resumes r ON r.id = a.resume_id
       WHERE a.id = $1`;

  const params = userId ? [applicationId, userId] : [applicationId];
  const { rows } = await queryClient.query(query, params);
  return rows[0] ?? null;
};

const findRecentDuplicate = async (userId, recipientEmail, normalizedJobTitle, normalizedCompanyName) => {
  const { rows } = await pool.query(
    `SELECT id, application_status, email_subject, email_body, created_at
     FROM applications
     WHERE user_id = $1
       AND recipient_email = $2
       AND normalized_job_title = $3
       AND normalized_company_name = $4
       AND created_at > NOW() - interval '24 hours'
       AND application_status NOT IN ('cancelled', 'failed')
     LIMIT 1`,
    [userId, recipientEmail, normalizedJobTitle, normalizedCompanyName]
  );
  return rows[0] ?? null;
};

const createApplication = async ({
  id,
  resumeId,
  jobDescriptionId,
  matchScore = null,
  emailSubject = null,
  emailBody = null,
  userId = null,
  client = null,
  applicationStatus = APPLICATION_STATUS.DRAFT,
  reviewReason = null,
  recipientEmail = null,
  resumeSnapshotPath = null,
  normalizedJobTitle = null,
  normalizedCompanyName = null,
  parsedJdSnapshot = null,
  parsedResumeSnapshot = null,
  matchScoreSnapshot = null,
  emailMetadata = null,
  emailFeedbackSignals = null,
  emailPreferencesSnapshot = null,
}) => {
  const queryClient = client || pool;

  const { rows } = await queryClient.query(
    `INSERT INTO applications (
        id, resume_id, job_description_id, match_score, email_subject, email_body, user_id,
        application_status, review_reason, recipient_email, resume_snapshot_path,
        normalized_job_title, normalized_company_name,
        parsed_jd_snapshot, parsed_resume_snapshot, match_score_snapshot,
        email_metadata, email_feedback_signals, email_preferences_snapshot
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
     ON CONFLICT (user_id, resume_id, job_description_id)
     DO UPDATE SET
        updated_at = NOW(),
        application_status = EXCLUDED.application_status,
        orchestration_version = CASE
          WHEN applications.application_status IS DISTINCT FROM EXCLUDED.application_status
          THEN applications.orchestration_version + 1
          ELSE applications.orchestration_version
        END,
        review_reason = EXCLUDED.review_reason,
        recipient_email = EXCLUDED.recipient_email,
        resume_snapshot_path = EXCLUDED.resume_snapshot_path,
        normalized_job_title = EXCLUDED.normalized_job_title,
        normalized_company_name = EXCLUDED.normalized_company_name
     RETURNING *`,
    [
      id,
      resumeId,
      jobDescriptionId,
      matchScore,
      emailSubject,
      emailBody,
      userId,
      applicationStatus,
      reviewReason,
      recipientEmail,
      resumeSnapshotPath,
      normalizedJobTitle,
      normalizedCompanyName,
      parsedJdSnapshot ? JSON.stringify(parsedJdSnapshot) : null,
      parsedResumeSnapshot ? JSON.stringify(parsedResumeSnapshot) : null,
      matchScoreSnapshot,
      emailMetadata ? JSON.stringify(emailMetadata) : null,
      emailFeedbackSignals ? JSON.stringify(emailFeedbackSignals) : null,
      emailPreferencesSnapshot ? JSON.stringify(emailPreferencesSnapshot) : null,
    ]
  );

  const row = rows[0];
  const isExisting = row.created_at.getTime() !== row.updated_at.getTime();
  return { ...row, idempotent: isExisting };
};

const updateApplicationFields = async (applicationId, fields, userId = null, client = pool) => {
  const allowed = [
    "email_subject",
    "email_body",
    "match_score",
    "recipient_email",
    "parsed_jd_snapshot",
    "parsed_resume_snapshot",
    "match_score_snapshot",
    "normalized_job_title",
    "normalized_company_name",
    "email_metadata",
    "email_feedback_signals",
    "email_preferences_snapshot",
  ];
  const sets = [];
  const values = [applicationId];
  let i = 2;
  for (const [key, val] of Object.entries(fields)) {
    if (!allowed.includes(key)) continue;
    sets.push(`${key} = $${i}`);
    values.push(typeof val === "object" && val !== null ? JSON.stringify(val) : val);
    i += 1;
  }
  if (!sets.length) return null;
  sets.push("updated_at = NOW()");
  let where = `id = $1`;
  if (userId) {
    where += ` AND user_id = $${i}`;
    values.push(userId);
  }
  const { rows } = await client.query(
    `UPDATE applications SET ${sets.join(", ")} WHERE ${where} RETURNING *`,
    values
  );
  return rows[0] ?? null;
};

/** CAS: generated → sent after successful SMTP */
const markSentFromGenerated = async (applicationId, userId, providerMessageId = null, client = pool) => {
  return transitionApplicationState(client, {
    applicationId,
    userId,
    expectedStatus: APPLICATION_STATUS.GENERATED,
    nextStatus: APPLICATION_STATUS.SENT,
    patch: {},
  }).then(async (r) => {
    if (!r.ok) return null;
    if (providerMessageId) {
      await client.query(
        `UPDATE applications SET provider_message_id = $2 WHERE id = $1`,
        [applicationId, providerMessageId]
      );
    }
    return r.row;
  });
};

/** CAS: business failure from draft/generated */
const markApplicationFailed = async (
  applicationId,
  errorMessage,
  failureStage,
  userId = null,
  client = pool
) => {
  return transitionApplicationState(client, {
    applicationId,
    userId,
    expectedStatus: [APPLICATION_STATUS.DRAFT, APPLICATION_STATUS.GENERATED],
    nextStatus: APPLICATION_STATUS.FAILED,
    clearReviewReason: true,
    patch: { lastError: errorMessage, failureStage },
  });
};

const listApplicationsForUser = async (userId, client = pool) => {
  const { rows } = await client.query(
    `SELECT a.*, jd.title as role, jd.company_name as company
     FROM applications a
     JOIN job_descriptions jd ON jd.id = a.job_description_id
     WHERE a.user_id = $1
     ORDER BY a.created_at DESC`,
    [userId]
  );
  return rows;
};

const { buildApplicationsListSql } = require("../services/applicationsListQuery");

const listApplicationsPaginated = async (userId, validatedParams, client = pool) => {
  const { sql, values, filterCount } = buildApplicationsListSql({
    userId,
    params: validatedParams,
  });
  const started = performance.now();
  const { rows } = await instrumentedQuery(
    client,
    "applications_list",
    sql,
    values,
    pool,
    { source: "applications_list", filterCount }
  );
  const durationMs = Math.round(performance.now() - started);
  const { logInfo } = require("../utils/logger");
  const { metrics } = require("../observability/orchestrationMetrics");
  logInfo("APPLICATIONS_LIST_QUERY", {
    page: validatedParams.page,
    pageSize: validatedParams.pageSize,
    sort: validatedParams.sort,
    order: validatedParams.order,
    filterCount,
    durationMs,
    rowCount: rows.length,
  });
  metrics.increment("applications.list.query", { pageSize: String(validatedParams.pageSize) });
  return { rows, durationMs };
};

module.exports = {
  getApplicationByResumeAndJD,
  getApplicationStatusSnapshot,
  getApplicationStatusBundle,
  STATUS_BUNDLE_SQL,
  mapBundleRow,
  getApplicationById,
  findRecentDuplicate,
  createApplication,
  updateApplicationFields,
  markSentFromGenerated,
  markApplicationFailed,
  listApplicationsForUser,
  listApplicationsPaginated,
  transitionApplicationState,
};
