-- Configurable marketing campaigns: trials, discounts, early access. Plans carry
-- no trial/discount knowledge; campaigns layer them on independently.
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('trial', 'discount', 'early_access')),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  user_limit INT,
  claimed_count INT NOT NULL DEFAULT 0,
  trial_days INT,
  discount_type TEXT CHECK (discount_type IN ('percent', 'fixed')),
  discount_amount INT,
  applicable_plan_ids UUID[] NOT NULL DEFAULT '{}',
  priority INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT campaigns_claimed_within_limit CHECK (user_limit IS NULL OR claimed_count <= user_limit)
);

CREATE INDEX IF NOT EXISTS idx_campaigns_enabled_window
  ON campaigns (enabled, starts_at, ends_at);

-- One redemption row == one consumed slot. No reserved/released states.
CREATE TABLE IF NOT EXISTS campaign_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID,
  payment_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_redemptions_campaign
  ON campaign_redemptions (campaign_id);
