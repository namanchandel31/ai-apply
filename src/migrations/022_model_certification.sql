-- AI Apply model certification (dev tool) — run history + curated production allowlist

CREATE TABLE IF NOT EXISTS model_certification_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  resume_source TEXT NOT NULL CHECK (resume_source IN ('active', 'upload')),
  certification_score SMALLINT NOT NULL DEFAULT 0,
  reliability_score SMALLINT NOT NULL DEFAULT 0,
  value_score NUMERIC NOT NULL DEFAULT 0,
  overall_score SMALLINT NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT false,
  recommended BOOLEAN NOT NULL DEFAULT false,
  scores_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_response_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_model_certification_runs_user_created
  ON model_certification_runs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_model_certification_runs_overall_score
  ON model_certification_runs (overall_score DESC);

CREATE TABLE IF NOT EXISTS curated_ai_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  certification_score SMALLINT NOT NULL DEFAULT 0,
  reliability_score SMALLINT NOT NULL DEFAULT 0,
  value_score NUMERIC NOT NULL DEFAULT 0,
  overall_score SMALLINT NOT NULL DEFAULT 0,
  certification_run_id UUID REFERENCES model_certification_runs(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  promoted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, model_id)
);

CREATE INDEX IF NOT EXISTS idx_curated_ai_models_provider_active
  ON curated_ai_models (provider, is_active, overall_score DESC);
