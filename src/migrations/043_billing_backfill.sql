-- Back-compat: migrate existing active subscribers and their last payment into
-- the new canonical tables. Legacy tier 'onetap_llm' maps to plan slug 'managed'.
-- Idempotent: only inserts when the user has no subscription row yet.
INSERT INTO user_subscriptions (user_id, plan_id, status, source, access_starts_at, access_ends_at)
SELECT
  u.id,
  p.id,
  'active',
  'migration',
  COALESCE(u.subscription_activated_at, NOW()),
  -- Grandfather a generous forward window; admins can adjust per user.
  COALESCE(u.subscription_activated_at, NOW()) + INTERVAL '3650 days'
FROM users u
JOIN plans p
  ON p.slug = CASE
    WHEN u.subscription_plan_id = 'onetap_llm' THEN 'managed'
    WHEN u.subscription_tier   = 'onetap_llm' THEN 'managed'
    WHEN u.subscription_plan_id IS NOT NULL    THEN u.subscription_plan_id
    WHEN u.subscription_tier IN ('byok','managed') THEN u.subscription_tier
    ELSE 'byok'
  END
WHERE u.subscription_status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM user_subscriptions us
    WHERE us.user_id = u.id AND us.status IN ('trialing', 'active')
  );

-- Copy verified legacy payments into the canonical ledger (idempotent on payment id).
INSERT INTO payments (user_id, plan_id, razorpay_order_id, razorpay_payment_id,
                      amount_paise, currency, status, created_at, captured_at)
SELECT
  upp.user_id,
  p.id,
  upp.razorpay_order_id,
  upp.razorpay_payment_id,
  upp.amount_paise,
  upp.currency,
  CASE WHEN upp.status = 'verified' THEN 'captured' ELSE 'created' END,
  upp.created_at,
  upp.verified_at
FROM user_plan_payments upp
LEFT JOIN plans p
  ON p.slug = CASE WHEN upp.plan_id = 'onetap_llm' THEN 'managed' ELSE upp.plan_id END
WHERE upp.razorpay_payment_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM payments pm WHERE pm.razorpay_payment_id = upp.razorpay_payment_id
  );
