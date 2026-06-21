-- Global, DB-driven application settings (admin-editable, no redeploy).
-- Key/value store resolved by settingsService under the precedence:
--   ENV kill-switch > app_settings > plan settings > campaign settings.
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed defaults (idempotent). paywall_trigger is restricted to a 3-value V1 enum
-- and validated in code (settingsService) against the allowlist.
INSERT INTO app_settings (key, value) VALUES
  ('paywall_enabled',      'false'::jsonb),
  ('trials_enabled',       'true'::jsonb),
  ('checkout_enabled',     'true'::jsonb),
  ('registration_enabled', 'true'::jsonb),
  ('paywall_trigger',      '"after_plan_selection"'::jsonb),
  ('grace_days',           '0'::jsonb),
  ('subscriptions_enabled','false'::jsonb)
ON CONFLICT (key) DO NOTHING;
