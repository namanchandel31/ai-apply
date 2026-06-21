-- Plans are pure data: created/archived/reordered/priced entirely from the Admin
-- Panel. No code branches on plan slug. Slugs are stable identifiers.
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  tier TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  popular BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT plans_slug_snake_case CHECK (slug ~ '^[a-z][a-z0-9_]*$')
);

CREATE INDEX IF NOT EXISTS idx_plans_active_sort
  ON plans (is_active, is_archived, sort_order);

-- Price points decouple amount + access duration from code.
CREATE TABLE IF NOT EXISTS plan_price_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  label TEXT,
  duration_days INT NOT NULL CHECK (duration_days > 0),
  amount_paise INT NOT NULL CHECK (amount_paise > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  -- Reserved for the future Razorpay Subscriptions migration (unused in Phase 1).
  interval TEXT,
  razorpay_plan_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_price_points_plan_active
  ON plan_price_points (plan_id, is_active);

-- Marketing copy shown on the pricing page (never read for authorization).
CREATE TABLE IF NOT EXISTS plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  included BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_plan_features_plan
  ON plan_features (plan_id, sort_order);

-- Enforced permissions: each row binds a catalog feature to a typed value for a
-- plan. The FK guarantees only catalog keys can be granted (no arbitrary keys).
CREATE TABLE IF NOT EXISTS plan_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES feature_definitions(id) ON DELETE RESTRICT,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plan_id, feature_id)
);

CREATE INDEX IF NOT EXISTS idx_plan_entitlements_plan ON plan_entitlements (plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_entitlements_feature ON plan_entitlements (feature_id);

-- Plan-driven onboarding: ordered step keys per plan.
CREATE TABLE IF NOT EXISTS onboarding_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL UNIQUE REFERENCES plans(id) ON DELETE CASCADE,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----- Seed the two launch plans (idempotent) -----
INSERT INTO plans (slug, display_name, description, tier, sort_order, popular) VALUES
  ('byok',    'Bring Your Own AI', 'Use your own AI provider API key with the full OneTap platform.', 'byok',    0, FALSE),
  ('managed', 'OneTap Managed AI', 'We provide the AI infrastructure end to end. Just sign up and go.', 'managed', 1, TRUE)
ON CONFLICT (slug) DO NOTHING;

-- Price points (30-day access). Amounts mirror the legacy billing config defaults.
INSERT INTO plan_price_points (plan_id, label, duration_days, amount_paise, currency)
SELECT p.id, '30 days', 30, 9900, 'INR' FROM plans p WHERE p.slug = 'byok'
  AND NOT EXISTS (SELECT 1 FROM plan_price_points pp WHERE pp.plan_id = p.id);
INSERT INTO plan_price_points (plan_id, label, duration_days, amount_paise, currency)
SELECT p.id, '30 days', 30, 14900, 'INR' FROM plans p WHERE p.slug = 'managed'
  AND NOT EXISTS (SELECT 1 FROM plan_price_points pp WHERE pp.plan_id = p.id);

-- Marketing features.
INSERT INTO plan_features (plan_id, label, included, sort_order)
SELECT p.id, v.label, v.included, v.sort_order
FROM plans p
JOIN (VALUES
  ('byok', 'Use your own AI provider key', TRUE,  0),
  ('byok', 'Unlimited workflow automation', TRUE, 1),
  ('byok', 'Application tracking',          TRUE, 2),
  ('byok', 'Managed AI infrastructure',     FALSE, 3)
) AS v(slug, label, included, sort_order) ON v.slug = p.slug
WHERE NOT EXISTS (SELECT 1 FROM plan_features f WHERE f.plan_id = p.id);

INSERT INTO plan_features (plan_id, label, included, sort_order)
SELECT p.id, v.label, v.included, v.sort_order
FROM plans p
JOIN (VALUES
  ('managed', 'Managed AI infrastructure',  TRUE, 0),
  ('managed', 'No API key setup required',  TRUE, 1),
  ('managed', 'Priority processing',        TRUE, 2),
  ('managed', 'Application tracking',       TRUE, 3)
) AS v(slug, label, included, sort_order) ON v.slug = p.slug
WHERE NOT EXISTS (SELECT 1 FROM plan_features f WHERE f.plan_id = p.id);

-- Entitlements (catalog-referenced). Values are typed JSON matching the feature.
INSERT INTO plan_entitlements (plan_id, feature_id, value)
SELECT p.id, fd.id, v.value::jsonb
FROM plans p
JOIN (VALUES
  ('byok', 'can_use_byok',              'true'),
  ('byok', 'can_use_managed_ai',        'false'),
  ('byok', 'can_bulk_apply',            'true'),
  ('byok', 'can_generate_cover_letter', 'true'),
  ('byok', 'monthly_application_limit', '1000'),
  ('byok', 'monthly_ai_credits',        '0'),
  ('byok', 'daily_auto_apply_limit',    '50'),
  ('byok', 'priority_processing',       'false'),
  ('byok', 'support_level',             '"standard"'),
  ('managed', 'can_use_byok',              'false'),
  ('managed', 'can_use_managed_ai',        'true'),
  ('managed', 'can_bulk_apply',            'true'),
  ('managed', 'can_generate_cover_letter', 'true'),
  ('managed', 'monthly_application_limit', '1000'),
  ('managed', 'monthly_ai_credits',        '500'),
  ('managed', 'daily_auto_apply_limit',    '50'),
  ('managed', 'priority_processing',       'true'),
  ('managed', 'support_level',             '"priority"')
) AS v(slug, feature_key, value) ON v.slug = p.slug
JOIN feature_definitions fd ON fd.key = v.feature_key
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- Onboarding flows: managed skips the BYOK step.
INSERT INTO onboarding_flows (plan_id, steps)
SELECT p.id, '["byok","resume","email"]'::jsonb FROM plans p WHERE p.slug = 'byok'
ON CONFLICT (plan_id) DO NOTHING;
INSERT INTO onboarding_flows (plan_id, steps)
SELECT p.id, '["resume","email"]'::jsonb FROM plans p WHERE p.slug = 'managed'
ON CONFLICT (plan_id) DO NOTHING;
