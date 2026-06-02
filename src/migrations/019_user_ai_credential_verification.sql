-- Onboarding: explicit verification lifecycle separate from runtime health_status

ALTER TABLE user_ai_credentials
  ADD COLUMN IF NOT EXISTS credential_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMPTZ NULL;

ALTER TABLE user_ai_credentials
  DROP CONSTRAINT IF EXISTS chk_user_ai_credentials_credential_status;

ALTER TABLE user_ai_credentials
  ADD CONSTRAINT chk_user_ai_credentials_credential_status
  CHECK (credential_status IN ('pending', 'valid', 'invalid'));

UPDATE user_ai_credentials
SET
  credential_status = CASE
    WHEN health_status = 'invalid' THEN 'invalid'
    WHEN health_status IN ('healthy', 'rate_limited', 'quota_exceeded') THEN 'valid'
    ELSE credential_status
  END,
  last_validated_at = CASE
    WHEN health_status IN ('healthy', 'rate_limited', 'quota_exceeded')
      THEN COALESCE(last_validated_at, updated_at, created_at, NOW())
    ELSE last_validated_at
  END
WHERE credential_status = 'pending'
   OR last_validated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_ai_credentials_verified
  ON user_ai_credentials (user_id)
  WHERE credential_status = 'valid' AND last_validated_at IS NOT NULL;
