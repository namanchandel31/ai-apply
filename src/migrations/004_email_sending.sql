ALTER TABLE applications
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS error JSONB;

ALTER TABLE applications
ADD CONSTRAINT IF NOT EXISTS check_status 
CHECK (status IN ('draft', 'sent', 'failed'));

ALTER TABLE applications
ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE resumes
ADD COLUMN IF NOT EXISTS user_id TEXT NULL,
ADD COLUMN IF NOT EXISTS file_path TEXT NULL;

CREATE TABLE IF NOT EXISTS user_email_credentials (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  encrypted_app_password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
