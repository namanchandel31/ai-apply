-- 013_status_poll_indexes.sql
-- Hot path: latest job per (application_id, job_type) for GET /applications/:id/status.
-- Complements idx_app_jobs_application (application_id, created_at DESC) from 011b.

CREATE INDEX IF NOT EXISTS idx_app_jobs_app_type_created
  ON application_jobs (application_id, job_type, created_at DESC);

-- idx_app_id_user on applications(id, user_id) already exists in 005_indexes_and_constraints.sql
