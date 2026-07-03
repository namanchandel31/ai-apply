-- Intelligent send queues: explicit BYOK denial; feature remains admin-granted on other plans.

UPDATE feature_definitions
SET default_value = 'false'::jsonb
WHERE key = 'can_use_intelligent_send_queues';

INSERT INTO plan_entitlements (plan_id, feature_id, value, updated_at)
SELECT p.id, fd.id, 'false'::jsonb, NOW()
FROM plans p
CROSS JOIN feature_definitions fd
WHERE p.slug = 'byok' AND fd.key = 'can_use_intelligent_send_queues'
ON CONFLICT (plan_id, feature_id) DO UPDATE
SET value = 'false'::jsonb, updated_at = NOW();
