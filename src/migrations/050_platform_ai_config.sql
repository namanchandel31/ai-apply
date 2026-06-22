-- Admin-managed OneTap AI: platform credentials + per-feature routing via certified models.

CREATE TABLE IF NOT EXISTS platform_ai_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL UNIQUE,
  label TEXT,
  encrypted_api_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_ai_feature_configs (
  feature_key TEXT PRIMARY KEY,
  certified_model_id UUID NOT NULL REFERENCES curated_ai_models(id) ON DELETE RESTRICT,
  credential_id UUID NOT NULL REFERENCES platform_ai_credentials(id) ON DELETE RESTRICT,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_ai_feature_configs_model
  ON platform_ai_feature_configs (certified_model_id);

INSERT INTO app_settings (key, value, updated_at)
VALUES ('platform_ai_enabled', 'true'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;
