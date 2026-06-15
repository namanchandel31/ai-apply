-- Source metadata for extension / external discovery captures.
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS source_platform TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS source_email TEXT,
  ADD COLUMN IF NOT EXISTS discovered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_company_name TEXT,
  ADD COLUMN IF NOT EXISTS source_recruiter_name TEXT,
  ADD COLUMN IF NOT EXISTS source_post_id TEXT;

CREATE INDEX IF NOT EXISTS idx_applications_source_platform
  ON applications (user_id, source_platform)
  WHERE source_platform IS NOT NULL;
