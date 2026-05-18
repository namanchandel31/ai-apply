CREATE TABLE IF NOT EXISTS user_ai_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_type TEXT NOT NULL DEFAULT 'remote',
  encrypted_api_key TEXT,
  selected_model TEXT,
  base_url TEXT,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  allow_platform_fallback BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, provider, label),
  CONSTRAINT chk_local_base_url
    CHECK (provider_type != 'local' OR base_url IS NOT NULL),
  CONSTRAINT chk_remote_api_key
    CHECK (provider_type != 'remote' OR encrypted_api_key IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_user_ai_credentials_user_active
  ON user_ai_credentials (user_id) WHERE is_active = true;

DROP TRIGGER IF EXISTS update_user_ai_credentials_updated_at ON user_ai_credentials;
CREATE TRIGGER update_user_ai_credentials_updated_at
  BEFORE UPDATE ON user_ai_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
