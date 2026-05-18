-- Enum values added in 006b_app_email_status_enum.sql (separate commit required by PostgreSQL).

-- User defaults (no default_credential_id — one cred per user via PK)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS default_resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL;

-- Application columns
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS recipient_email              TEXT,
  ADD COLUMN IF NOT EXISTS resume_snapshot_path         TEXT,
  ADD COLUMN IF NOT EXISTS provider_message_id          TEXT,
  ADD COLUMN IF NOT EXISTS normalized_job_title         TEXT,
  ADD COLUMN IF NOT EXISTS normalized_company_name      TEXT,
  ADD COLUMN IF NOT EXISTS parsed_jd_snapshot           JSONB,
  ADD COLUMN IF NOT EXISTS parsed_resume_snapshot       JSONB,
  ADD COLUMN IF NOT EXISTS match_score_snapshot         INTEGER,
  ADD COLUMN IF NOT EXISTS processing_attempts          INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_processing_attempt_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_started_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_stage                TEXT;

-- Relax match_score NOT NULL
ALTER TABLE applications ALTER COLUMN match_score DROP NOT NULL;

-- Dedup index: user + recipient + normalized title + company (24h window)
CREATE INDEX IF NOT EXISTS idx_app_dedup_lookup
  ON applications(user_id, recipient_email, normalized_job_title, normalized_company_name, created_at DESC)
  WHERE recipient_email IS NOT NULL;

-- Queued job recovery polling
CREATE INDEX IF NOT EXISTS idx_app_queued_recovery
  ON applications(created_at)
  WHERE email_status = 'queued' AND processing_started_at IS NULL;

-- Stalled processing recovery
CREATE INDEX IF NOT EXISTS idx_app_stalled_processing
  ON applications(processing_started_at)
  WHERE email_status = 'processing';
