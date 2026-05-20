-- Migrate email_status → application_status; add jobs, events, review_reason.

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS application_status application_status_enum,
  ADD COLUMN IF NOT EXISTS review_reason TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;

-- Backfill application_status from legacy email_status
UPDATE applications
SET application_status = CASE email_status::text
  WHEN 'pending' THEN 'draft'::application_status_enum
  WHEN 'needs_review' THEN 'needs_review'::application_status_enum
  WHEN 'sent' THEN 'sent'::application_status_enum
  WHEN 'failed' THEN 'failed'::application_status_enum
  WHEN 'abandoned' THEN 'failed'::application_status_enum
  WHEN 'queued' THEN (
    CASE
      WHEN email_subject IS NOT NULL AND trim(email_subject) <> '' THEN 'generated'::application_status_enum
      ELSE 'draft'::application_status_enum
    END
  )
  WHEN 'processing' THEN (
    CASE
      WHEN email_subject IS NOT NULL AND trim(email_subject) <> '' THEN 'generated'::application_status_enum
      ELSE 'draft'::application_status_enum
    END
  )
  WHEN 'retrying' THEN 'failed'::application_status_enum
  ELSE 'draft'::application_status_enum
END
WHERE application_status IS NULL AND email_status IS NOT NULL;

UPDATE applications
SET application_status = 'draft'::application_status_enum
WHERE application_status IS NULL;

ALTER TABLE applications
  ALTER COLUMN application_status SET DEFAULT 'draft'::application_status_enum;

ALTER TABLE applications
  ALTER COLUMN application_status SET NOT NULL;

-- needs_review rows should retain review context when missing
UPDATE applications
SET review_reason = COALESCE(review_reason, 'missing_contact_email')
WHERE application_status = 'needs_review'::application_status_enum
  AND review_reason IS NULL;

UPDATE applications
SET completed_at = sent_at
WHERE application_status = 'sent'::application_status_enum
  AND completed_at IS NULL
  AND sent_at IS NOT NULL;

DROP INDEX IF EXISTS idx_app_email_status;
DROP INDEX IF EXISTS idx_app_queued_recovery;
DROP INDEX IF EXISTS idx_app_stalled_processing;

ALTER TABLE applications DROP COLUMN IF EXISTS email_status;

ALTER TABLE applications DROP CONSTRAINT IF EXISTS chk_status;
ALTER TABLE applications DROP COLUMN IF EXISTS status;

CREATE INDEX IF NOT EXISTS idx_app_application_status
  ON applications(application_status);

CREATE INDEX IF NOT EXISTS idx_app_user_created
  ON applications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_recovery_candidates
  ON applications(application_status, created_at)
  WHERE application_status IN ('draft', 'generated', 'failed')
    AND review_reason IS NULL;

CREATE TABLE IF NOT EXISTS application_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('ai_process', 'send_email')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'retrying', 'completed', 'failed')),
  retry_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  bullmq_job_id TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_jobs_application
  ON application_jobs(application_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_jobs_status
  ON application_jobs(status, updated_at);

CREATE INDEX IF NOT EXISTS idx_app_jobs_stuck_processing
  ON application_jobs(started_at)
  WHERE status = 'processing';

CREATE TABLE IF NOT EXISTS application_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('system', 'user', 'worker')),
  actor_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_events_application
  ON application_events(application_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_events_type
  ON application_events(event_type);

CREATE INDEX IF NOT EXISTS idx_app_events_created
  ON application_events(created_at);
