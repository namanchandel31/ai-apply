# PostHog dashboards

## North Star

**Activated Users** — users who send their first application (`user_activated`).

Supporting metrics: Landing→Signup %, Signup→Onboarding %, Onboarding→Activation %, Activation→Paid %, WAU activated, applications per active user.

## Dashboard ownership

| Dashboard | Owner |
|-----------|-------|
| Acquisition, Landing | Growth |
| Signup, Onboarding, Activation, Product Usage, Retention | Product |
| Billing | Founder |
| Errors, AI Cost | Engineering |

## 1. Acquisition

**Funnel:** `$pageview` → `user_signed_up` → `user_activated` → `subscription_activated`  
**Breakdown:** `utm_source`, `utm_medium`, `utm_campaign`, `referral_code`

## 2. Landing

**KPIs:** visitors, time on page (`$pageleave`), section views, scroll depth, CTA→signup  
**Events:** `landing_section_viewed`, `landing_scroll_depth_reached`, `landing_cta_engaged`, `landing_faq_expanded`

## 3. Signup

**Funnel:** `landing_cta_engaged` → `signup_started` → `signup_completed` → `user_signed_up`

## 4. Onboarding

**Flow:** resume (required) → gmail oauth/app_password (skippable) → extension (skippable)  
**Events:** `onboarding_step_started|completed|skipped|failed`, `resume_uploaded`, `gmail_connected`, `onboarding_completed`

## 5. Activation

**Funnel:** `user_signed_up` → `onboarding_completed` → `setup_ready` → `application_started` → `user_activated`

## 6. Product usage

**Events:** `$pageview` by `page_name`, `setup_viewed`, `apply_mode_changed`

## 7. Billing

**Funnel:** `pricing_viewed` → `plan_engaged` → `checkout_started` → `checkout_completed` → `subscription_activated`

## 8. Retention

**Cohorts:** `user_signed_up`, `user_activated`  
**Metrics:** D1/D7/D30, WAU/MAU, `applications_sent_count`

## 9. Errors

**Filter:** `event_tier = operational`  
**Events:** `api_error`, `onboarding_step_failed`, `application_processing_failed`, `ai_request_failed`

## 10. AI cost & performance

**Events:** `ai_request_started|completed|failed`  
**Metrics:** latency p50/p95, token usage, `estimated_cost`, cost per application

## Future alerts (document only)

- Landing→signup drop >20% WoW
- Onboarding completion drop >15%
- Activation rate drop >15%
- Checkout abandonment spike
- AI failure rate >10%
- Application send failures >5%/hour
