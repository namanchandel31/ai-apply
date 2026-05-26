const SORT_COLUMN_MAP = {
  created_at: "a.created_at",
  updated_at: "a.updated_at",
  match_score: "a.match_score",
  normalized_company_name: "a.normalized_company_name",
  application_status: "a.application_status",
};

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Build parameterized WHERE fragments and values from validated list query.
 * @param {import("../schemas/validateApplicationsListQuery").validateApplicationsListQuery extends Function ? never : { userId: string, params: object }} options
 */
function buildApplicationsListSql({ userId, params }) {
  const conditions = ["a.user_id = $1"];
  const values = [userId];
  let paramIndex = 2;

  if (params.status?.length) {
    conditions.push(`a.application_status = ANY($${paramIndex}::application_status_enum[])`);
    values.push(params.status);
    paramIndex += 1;
  }

  if (params.datePreset === "today") {
    conditions.push(`a.created_at >= $${paramIndex}`);
    values.push(startOfUtcDay());
    paramIndex += 1;
  } else if (params.datePreset === "last7") {
    conditions.push(`a.created_at >= NOW() - interval '7 days'`);
  } else if (params.datePreset === "last30") {
    conditions.push(`a.created_at >= NOW() - interval '30 days'`);
  } else if (params.datePreset === "custom" && params.dateFrom && params.dateTo) {
    conditions.push(`a.created_at >= $${paramIndex}`);
    values.push(new Date(params.dateFrom));
    paramIndex += 1;
    conditions.push(`a.created_at < $${paramIndex}::date + interval '1 day'`);
    values.push(new Date(params.dateTo));
    paramIndex += 1;
  } else if (params.dateFrom) {
    conditions.push(`a.created_at >= $${paramIndex}`);
    values.push(new Date(params.dateFrom));
    paramIndex += 1;
  } else if (params.dateTo) {
    conditions.push(`a.created_at < $${paramIndex}::date + interval '1 day'`);
    values.push(new Date(params.dateTo));
    paramIndex += 1;
  }

  if (params.q) {
    conditions.push(
      `(a.normalized_company_name % $${paramIndex} OR a.normalized_job_title % $${paramIndex} OR a.normalized_company_name ILIKE $${paramIndex + 1} OR a.normalized_job_title ILIKE $${paramIndex + 1} OR jd.title ILIKE $${paramIndex + 1})`
    );
    values.push(params.q, `${params.q}%`);
    paramIndex += 2;
  }

  const sortCol = SORT_COLUMN_MAP[params.sort] || SORT_COLUMN_MAP.created_at;
  const orderDir = params.order === "asc" ? "ASC" : "DESC";
  const nullsClause =
    params.sort === "match_score" ? ` NULLS ${params.order === "asc" ? "FIRST" : "LAST"}` : "";

  const orderBy = `${sortCol} ${orderDir}${nullsClause}, a.id ${orderDir}`;

  const offset = (params.page - 1) * params.pageSize;
  values.push(params.pageSize, offset);

  const whereSql = conditions.join(" AND ");
  const limitParam = paramIndex;
  const offsetParam = paramIndex + 1;

  const sql = `
SELECT
  a.*,
  jd.title AS role,
  jd.company_name AS company,
  COUNT(*) OVER()::int AS total_count,
  pj.id AS process_job_id,
  pj.status AS process_job_status,
  pj.created_at AS process_job_created_at,
  pj.updated_at AS process_job_updated_at,
  pj.last_error AS process_job_last_error,
  pj.retry_count AS process_job_retry_count,
  sj.id AS send_job_id,
  sj.status AS send_job_status,
  sj.created_at AS send_job_created_at,
  sj.updated_at AS send_job_updated_at,
  sj.last_error AS send_job_last_error,
  sj.retry_count AS send_job_retry_count
FROM applications a
JOIN job_descriptions jd ON jd.id = a.job_description_id
LEFT JOIN LATERAL (
  SELECT id, status, created_at, updated_at, last_error, retry_count
  FROM application_jobs
  WHERE application_id = a.id AND job_type = 'ai_process'
  ORDER BY created_at DESC
  LIMIT 1
) pj ON true
LEFT JOIN LATERAL (
  SELECT id, status, created_at, updated_at, last_error, retry_count
  FROM application_jobs
  WHERE application_id = a.id AND job_type = 'send_email'
  ORDER BY created_at DESC
  LIMIT 1
) sj ON true
WHERE ${whereSql}
ORDER BY ${orderBy}
LIMIT $${limitParam} OFFSET $${offsetParam}`;

  return { sql, values, filterCount: (params.status?.length ? 1 : 0) + (params.q ? 1 : 0) + (params.datePreset ? 1 : 0) };
}

module.exports = {
  buildApplicationsListSql,
  SORT_COLUMN_MAP,
};
