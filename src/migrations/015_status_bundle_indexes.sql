-- Speed up status_bundle lateral job lookups (application_id + job_type + latest created_at)
CREATE INDEX IF NOT EXISTS idx_app_jobs_app_type_created
  ON application_jobs (application_id, job_type, created_at DESC);
