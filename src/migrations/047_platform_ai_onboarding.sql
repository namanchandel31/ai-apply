-- Platform-managed AI for free trial: enable managed AI by default and resume+email onboarding.

UPDATE feature_definitions
SET default_value = 'true'::jsonb, updated_at = NOW()
WHERE key = 'can_use_managed_ai';

-- Free-tier users without a plan use catalog defaults; managed AI is now on by default.
