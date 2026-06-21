-- Generic quota tracking. One table meters every numeric catalog feature; the
-- bucket (period_type + period_start) gives natural resets with no cron.
CREATE TABLE IF NOT EXISTS usage_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'lifetime')),
  period_start DATE NOT NULL,
  usage_count BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, feature_key, period_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_counters_user_feature
  ON usage_counters (user_id, feature_key, period_type);
