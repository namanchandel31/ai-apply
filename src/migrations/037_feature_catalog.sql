-- Feature Catalog: the single source of truth for every entitlement key.
-- No entitlement key may exist outside this table. Keys are immutable once
-- created and must follow the snake_case naming convention (enforced in code).
CREATE TABLE IF NOT EXISTS feature_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('boolean', 'number', 'string', 'enum', 'json')),
  default_value JSONB,
  enum_options JSONB,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- snake_case keys only: lowercase, digits, underscores; must start with a letter.
  CONSTRAINT feature_definitions_key_snake_case CHECK (key ~ '^[a-z][a-z0-9_]*$')
);

CREATE INDEX IF NOT EXISTS idx_feature_definitions_category_active
  ON feature_definitions (category, is_active);

-- Seed the initial catalog (idempotent).
INSERT INTO feature_definitions (key, display_name, description, type, default_value, enum_options, category) VALUES
  ('can_use_byok',             'BYOK Access',            'User can connect their own AI provider API key',        'boolean', 'false'::jsonb, NULL, 'ai'),
  ('can_use_managed_ai',       'Managed AI',             'User can use OneTap-provided AI infrastructure',         'boolean', 'false'::jsonb, NULL, 'ai'),
  ('can_bulk_apply',           'Bulk Apply',            'User can apply to multiple roles in one action',         'boolean', 'false'::jsonb, NULL, 'applications'),
  ('can_generate_cover_letter','Cover Letter Generation','User can generate cover letters',                       'boolean', 'false'::jsonb, NULL, 'applications'),
  ('monthly_application_limit','Monthly Applications',   'Max applications submitted per month (-1 = unlimited)',   'number',  '0'::jsonb,     NULL, 'applications'),
  ('monthly_ai_credits',       'Monthly AI Credits',     'AI credits consumable per month (-1 = unlimited)',       'number',  '0'::jsonb,     NULL, 'ai'),
  ('daily_auto_apply_limit',   'Daily Auto-Apply Limit', 'Max auto-applies per day (-1 = unlimited)',              'number',  '0'::jsonb,     NULL, 'applications'),
  ('priority_processing',      'Priority Processing',    'Jobs are processed at higher priority',                  'boolean', 'false'::jsonb, NULL, 'processing'),
  ('support_level',            'Support Level',          'Customer support tier',                                  'enum',    '"standard"'::jsonb, '["standard","priority"]'::jsonb, 'support')
ON CONFLICT (key) DO NOTHING;
