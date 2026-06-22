-- Enrich LLM telemetry for platform vs BYOK analytics and certified model attribution.

ALTER TABLE llm_usage_logs
  ADD COLUMN IF NOT EXISTS feature_key TEXT,
  ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS certified_model_id UUID REFERENCES curated_ai_models(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_llm_usage_logs_feature_created
  ON llm_usage_logs (feature_key, created_at DESC)
  WHERE feature_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_llm_usage_logs_credential_source_created
  ON llm_usage_logs (credential_source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_llm_usage_logs_certified_model
  ON llm_usage_logs (certified_model_id)
  WHERE certified_model_id IS NOT NULL;
