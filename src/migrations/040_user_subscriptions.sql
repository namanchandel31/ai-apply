-- Canonical entitlement record: a time-boxed access period (Phase 1 = Razorpay
-- Orders, renewable, no auto-debit). access_ends_at is independent of plan_id so
-- a plan switch can carry forward remaining time without proration.
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  price_point_id UUID REFERENCES plan_price_points(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN
    ('trialing', 'active', 'expired', 'cancelled', 'past_due', 'in_grace', 'paused')),
  source TEXT NOT NULL CHECK (source IN ('checkout', 'trial', 'admin_grant', 'migration')),
  access_starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  access_ends_at TIMESTAMPTZ,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  last_payment_id UUID,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  -- Reserved for the future Razorpay Subscriptions migration (unused in Phase 1).
  razorpay_subscription_id TEXT UNIQUE,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  grace_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- At most one live (trialing/active) subscription per user.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_live_subscription
  ON user_subscriptions (user_id)
  WHERE status IN ('trialing', 'active');

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status
  ON user_subscriptions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status_access_ends
  ON user_subscriptions (status, access_ends_at);

-- Canonical payment ledger (supersedes user_plan_payments).
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
  price_point_id UUID REFERENCES plan_price_points(id) ON DELETE SET NULL,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT UNIQUE,
  amount_paise INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'captured', 'failed', 'refunded', 'partially_refunded')),
  method TEXT,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  discount_amount_paise INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  captured_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_user_created
  ON payments (user_id, created_at DESC);

-- Tracks in-flight checkouts; drives recovery/reconciliation.
CREATE TABLE IF NOT EXISTS payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  price_point_id UUID NOT NULL REFERENCES plan_price_points(id) ON DELETE RESTRICT,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  intended_amount_paise INT NOT NULL,
  discount_amount_paise INT NOT NULL DEFAULT 0,
  razorpay_order_id TEXT UNIQUE,
  razorpay_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'succeeded', 'abandoned', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_status_created
  ON payment_attempts (status, created_at);

-- Webhook idempotency + audit. Used by optional order.paid now; full event set later.
CREATE TABLE IF NOT EXISTS billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processing_status TEXT NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received', 'processed', 'failed')),
  error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_type ON billing_events (event_type);
