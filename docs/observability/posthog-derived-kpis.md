# PostHog derived KPIs

Calculated in PostHog from event timestamps — no extra events required.

## Conversion rates

| KPI | Formula |
|-----|---------|
| Landing conversion | `user_signed_up` / unique `$pageview` on `/` |
| Signup conversion | `user_signed_up` / `signup_started` |
| Onboarding completion | `onboarding_completed` / `user_signed_up` |
| Activation rate | `user_activated` / `onboarding_completed` |
| Paid conversion | `subscription_activated` / `user_activated` |

## Timing metrics

| Metric | Calculation |
|--------|-------------|
| `signup_to_resume_ms` | `resume_uploaded` − `user_signed_up` |
| `signup_to_onboarding_completed_ms` | `onboarding_completed` − `user_signed_up` |
| `signup_to_activation_ms` | `user_activated` − `user_signed_up` |
| `activation_to_subscription_ms` | `subscription_activated` − `user_activated` |
| Step duration | `duration_ms` on `onboarding_step_completed` |

## Engagement

| KPI | Formula |
|-----|---------|
| Applications per WAU | count `application_sent` / WAU |
| Weekly activated users | unique `user_activated` per week |
| AI cost per application | Σ `estimated_cost` / `application_sent` |
| AI cost per activated user | Σ `estimated_cost` / activated users |

## Lifecycle stages

Person property `current_lifecycle_stage`: `anonymous` → `new` → `onboarding` → `activated` → `subscriber` → `inactive`
