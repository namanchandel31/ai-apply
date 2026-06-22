-- Referral program + idempotent quota consumption + reconciliation events.

ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'rejected', 'expired')),
  successful_send_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  CONSTRAINT referrals_no_self CHECK (referrer_user_id != referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals (referrer_user_id, status);
CREATE INDEX IF NOT EXISTS idx_referrals_expires ON referrals (expires_at) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL UNIQUE REFERENCES referrals(id) ON DELETE CASCADE,
  referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  applications_granted INT NOT NULL CHECK (applications_granted > 0),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON referral_rewards (referrer_user_id);

CREATE TABLE IF NOT EXISTS quota_consumption_events (
  application_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quota_reconciliation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quota_reconciliation_user_created
  ON quota_reconciliation_events (user_id, created_at DESC);

INSERT INTO app_settings (key, value, updated_at)
VALUES
  ('referral_program_enabled', 'true'::jsonb, NOW()),
  ('referral_reward_applications', '10'::jsonb, NOW()),
  ('referral_required_successful_applications', '1'::jsonb, NOW()),
  ('referral_max_rewards_per_user', '5'::jsonb, NOW()),
  ('referral_completion_window_hours', '24'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;
