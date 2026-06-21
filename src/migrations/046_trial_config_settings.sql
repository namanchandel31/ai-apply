-- Admin-configurable trial strategy: usage-based (metered quotas) vs time-based (N days access).
INSERT INTO app_settings (key, value) VALUES
  ('trial_mode',              '"usage"'::jsonb),
  ('default_trial_days',      '7'::jsonb),
  ('default_trial_plan_slug', '"byok"'::jsonb)
ON CONFLICT (key) DO NOTHING;
