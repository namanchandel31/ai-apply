-- Metered usage allowances are DATA, not code constants. They live as numeric catalog
-- features resolved through the same entitlement system as paid plans, so an admin can
-- retune them (conversion/pricing experiments) with no deploy. Unsubscribed users fall
-- back to these catalog defaults; paid plans override to unlimited (-1).
--
-- Keys are provider-neutral (quota_*) on purpose: the same counters back the free trial
-- today and will back paid tiers, campaigns, enterprise plans, and promo credits later —
-- only the resolved limit changes per plan. Avoid trial-specific naming leaking forward.

-- If an earlier revision of this migration seeded the trial-specific keys, rename them in
-- place so existing usage rows and entitlements keep counting (keys are immutable, so we
-- migrate rather than orphan). No-ops on a fresh database.
UPDATE feature_definitions SET key = 'quota_resumes_parsed'     WHERE key = 'free_trial_resumes_parsed';
UPDATE feature_definitions SET key = 'quota_jds_parsed'         WHERE key = 'free_trial_jds_parsed';
UPDATE feature_definitions SET key = 'quota_emails_generated'   WHERE key = 'free_trial_emails_generated';
UPDATE feature_definitions SET key = 'quota_applications_sent'  WHERE key = 'free_trial_applications_sent';
UPDATE usage_counters SET feature_key = 'quota_resumes_parsed'    WHERE feature_key = 'free_trial_resumes_parsed';
UPDATE usage_counters SET feature_key = 'quota_jds_parsed'        WHERE feature_key = 'free_trial_jds_parsed';
UPDATE usage_counters SET feature_key = 'quota_emails_generated'  WHERE feature_key = 'free_trial_emails_generated';
UPDATE usage_counters SET feature_key = 'quota_applications_sent' WHERE feature_key = 'free_trial_applications_sent';

INSERT INTO feature_definitions (key, display_name, description, type, default_value, category) VALUES
  ('quota_resumes_parsed',     'Resume Parses (allowance)',     'Lifetime resume parses before an active plan is required (admin-editable)',          'number', '2'::jsonb,  'quota'),
  ('quota_jds_parsed',         'JD Parses (allowance)',         'Lifetime job-description parses before an active plan is required (admin-editable)', 'number', '10'::jsonb, 'quota'),
  ('quota_emails_generated',   'Emails Generated (allowance)',  'Lifetime AI emails generated before an active plan is required (admin-editable)',    'number', '10'::jsonb, 'quota'),
  ('quota_applications_sent',  'Applications Sent (allowance)', 'Lifetime applications sent before an active plan is required (admin-editable)',      'number', '10'::jsonb, 'quota')
ON CONFLICT (key) DO NOTHING;

-- Paid/launch plans get unlimited usage for the metered features.
INSERT INTO plan_entitlements (plan_id, feature_id, value)
SELECT p.id, fd.id, '-1'::jsonb
FROM plans p
CROSS JOIN feature_definitions fd
WHERE p.slug IN ('byok', 'managed')
  AND fd.key IN (
    'quota_resumes_parsed',
    'quota_jds_parsed',
    'quota_emails_generated',
    'quota_applications_sent'
  )
ON CONFLICT (plan_id, feature_id) DO NOTHING;
