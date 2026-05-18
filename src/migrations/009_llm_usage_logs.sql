CREATE TABLE IF NOT EXISTS llm_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  model TEXT,
  endpoint TEXT,
  credential_source TEXT NOT NULL DEFAULT 'platform',
  prompt_tokens INT DEFAULT 0,
  completion_tokens INT DEFAULT 0,
  total_tokens INT DEFAULT 0,
  estimated_cost NUMERIC(12, 6),
  latency_ms INT,
  retries INT DEFAULT 0,
  success BOOLEAN NOT NULL,
  error_code TEXT,
  req_id TEXT,
  prompt_version TEXT,
  prompt_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_logs_user_created
  ON llm_usage_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_llm_usage_logs_prompt_hash
  ON llm_usage_logs (prompt_hash) WHERE prompt_hash IS NOT NULL;
