-- Multi-credential chain: priority ordering, health, disable-without-delete

ALTER TABLE user_ai_credentials
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS health_status TEXT NOT NULL DEFAULT 'healthy',
  ADD COLUMN IF NOT EXISTS health_updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS in_fallback_chain BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE user_ai_credentials
  DROP CONSTRAINT IF EXISTS chk_user_ai_credentials_health_status;

ALTER TABLE user_ai_credentials
  ADD CONSTRAINT chk_user_ai_credentials_health_status
  CHECK (health_status IN ('healthy', 'invalid', 'rate_limited', 'quota_exceeded'));

-- Backfill: active row becomes primary; others ordered by created_at
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id
           ORDER BY CASE WHEN is_active THEN 0 ELSE 1 END, created_at ASC
         ) - 1 AS new_priority
  FROM user_ai_credentials
)
UPDATE user_ai_credentials u
SET priority = ranked.new_priority,
    is_active = (ranked.new_priority = 0)
FROM ranked
WHERE u.id = ranked.id;

-- Temp-offset compaction for any duplicate priority=0 from legacy data
UPDATE user_ai_credentials SET priority = priority + 10000;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY priority ASC, created_at ASC) - 1 AS p
  FROM user_ai_credentials
)
UPDATE user_ai_credentials u
SET priority = ranked.p,
    is_active = (ranked.p = 0)
FROM ranked
WHERE u.id = ranked.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_ai_credentials_one_primary
  ON user_ai_credentials (user_id)
  WHERE priority = 0;

CREATE INDEX IF NOT EXISTS idx_user_ai_credentials_user_priority
  ON user_ai_credentials (user_id, priority);
