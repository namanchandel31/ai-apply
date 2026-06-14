ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tracker_status_options JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS tracker_status_id TEXT;

CREATE INDEX IF NOT EXISTS idx_applications_user_tracker_status
  ON applications (user_id, tracker_status_id)
  WHERE tracker_status_id IS NOT NULL;
