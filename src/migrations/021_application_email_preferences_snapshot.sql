ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS email_preferences_snapshot JSONB;
