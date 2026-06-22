-- OneTap AI: single global model, multiple API keys per provider with traffic weights.
-- Admin user controls: block + bonus application grants.

ALTER TABLE platform_ai_credentials
  DROP CONSTRAINT IF EXISTS platform_ai_credentials_provider_key;

ALTER TABLE platform_ai_credentials
  ADD COLUMN IF NOT EXISTS traffic_weight INT NOT NULL DEFAULT 100
    CHECK (traffic_weight >= 0);

CREATE TABLE IF NOT EXISTS platform_ai_global_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  certified_model_id UUID NOT NULL REFERENCES curated_ai_models(id) ON DELETE RESTRICT,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migrate from per-feature routing when present (prefer email_generate, else any row).
INSERT INTO platform_ai_global_config (certified_model_id, is_enabled)
SELECT certified_model_id, is_enabled
FROM platform_ai_feature_configs
WHERE feature_key = 'email_generate'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO platform_ai_global_config (certified_model_id, is_enabled)
SELECT certified_model_id, is_enabled
FROM platform_ai_feature_configs
WHERE NOT EXISTS (SELECT 1 FROM platform_ai_global_config)
LIMIT 1;

DROP TABLE IF EXISTS platform_ai_feature_configs;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
  ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS admin_application_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  applications_granted INT NOT NULL CHECK (applications_granted > 0),
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_application_grants_user
  ON admin_application_grants (user_id);

ALTER TABLE llm_usage_logs
  ADD COLUMN IF NOT EXISTS platform_credential_id UUID
    REFERENCES platform_ai_credentials(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_llm_usage_logs_platform_credential
  ON llm_usage_logs (platform_credential_id)
  WHERE platform_credential_id IS NOT NULL;
