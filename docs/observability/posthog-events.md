# PostHog event registry

North Star: **Activated Users** = first `application_sent` with `is_first_send: true` → `user_activated`.

## Event tiers

| Tier | Use |
|------|-----|
| `business` | Stable KPIs — never rename casually |
| `product` | Feature usage and funnels |
| `operational` | Debug only — exclude from product dashboards |

## Business events (schema_version: 1)

| Registry ID | Event | Owner | Trigger |
|-------------|-------|-------|---------|
| SIGNUP_001 | `user_signed_up` | Backend | First `insertNewUserFromSupabase` |
| ONBOARDING_006 | `onboarding_completed` | Backend | Setup status: flow complete (once per user) |
| ACTIVATION_001 | `user_activated` | Backend | First `application_sent` |
| APPLICATION_007 | `application_sent` | Backend | Send worker success |
| BILLING_004 | `checkout_completed` | Backend | Payment verified |
| BILLING_005 | `subscription_activated` | Backend | `grantAccessPeriod` non-idempotent |

## Product events (selected)

| Registry ID | Event | Owner |
|-------------|-------|-------|
| LANDING_004 | `landing_cta_engaged` | Frontend |
| LANDING_002 | `landing_section_viewed` | Frontend |
| SIGNUP_002 | `signup_started` | Frontend |
| SIGNUP_003 | `signup_completed` | Frontend |
| ONBOARDING_002–004 | `onboarding_step_*` | Frontend |
| ONBOARDING_007 | `resume_uploaded` | Backend |
| ONBOARDING_009 | `gmail_connected` | Backend |
| ONBOARDING_010 | `extension_connected` | Backend |
| ACTIVATION_003 | `application_started` | Backend |
| BILLING_001 | `pricing_viewed` | Frontend |

## Operational events

| Registry ID | Event | Owner |
|-------------|-------|-------|
| AI_001–003 | `ai_request_*` | Backend (aiGateway) |
| ERROR_001 | `api_error` | Frontend |

## Standard properties (auto-injected)

`event_tier`, `schema_version`, `timestamp`, `app_version`, `environment`, `platform`, `authenticated`, `subscription_tier`, `page_name`, `page_path`, `session_id`, `distinct_id`, `workflow_id`, `request_id`

## Person properties

`signup_date`, `activation_date`, `subscription_date`, `utm_*`, `referral_code`, `current_lifecycle_stage`, `applications_sent_count`, `resume_uploaded`, `gmail_connected`, `extension_connected`, `ai_configured`, adoption stage fields.

See [posthog-dashboards.md](./posthog-dashboards.md) and [posthog-derived-kpis.md](./posthog-derived-kpis.md).
