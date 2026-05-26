-- Paginated applications list: composite sort/filter indexes + trigram search.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_app_user_status_created
  ON applications (user_id, application_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_user_updated
  ON applications (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_user_match_score
  ON applications (user_id, match_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_app_user_company
  ON applications (user_id, normalized_company_name);

CREATE INDEX IF NOT EXISTS idx_app_company_trgm
  ON applications USING gin (normalized_company_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_app_title_trgm
  ON applications USING gin (normalized_job_title gin_trgm_ops);
