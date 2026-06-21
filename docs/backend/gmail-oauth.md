# Gmail OAuth Integration

Gmail OAuth lets a user connect their Google account so OneTap sends job
applications **from their own address** via the Gmail API (`users.messages.send`),
as an alternative to the legacy SMTP app-password path. Everything is behind a
transport-agnostic provider abstraction so Outlook/M365 and future reply-tracking
plug in without touching application logic.

## Scope strategy (least privilege)

- Default consent requests **`gmail.send` only** — a Google *sensitive* scope. This
  keeps MVP out of the *restricted*-scope tier (which needs an annual CASA security
  assessment) and maximizes onboarding conversion.
- `gmail.readonly` (restricted) is **never requested by default**. It is architected
  for a future opt-in "reply tracking / inbox sync" tier, gated behind
  `GMAIL_READ_TIER_ENABLED` (server) and `VITE_GMAIL_READ_TIER_ENABLED` (UI).
- We also request `openid` + `userinfo.email` to identify the connected account.
- `threadId`/`messageId` are persisted on every send so future reply tracking is cheap.

## Components

| Concern | File |
| --- | --- |
| Config / scopes / flags | `src/config/google.config.js` |
| Token encryption (AES-256-GCM) | `src/utils/encryption.js` (`encryptSecret`/`decryptSecret`) |
| Provider interface | `src/services/email/providers/EmailProvider.js` |
| Gmail provider | `src/services/email/providers/GmailProvider.js` |
| SMTP provider | `src/services/email/providers/SmtpProvider.js` |
| Provider registry | `src/services/email/providerRegistry.js` |
| Token lifecycle | `src/services/oauthTokenService.js` |
| OAuth connect/callback/status/disconnect | `src/services/gmailIntegrationService.js`, `src/controllers/gmailIntegrationController.js`, `src/routes/gmailIntegrationRoutes.js` |
| Send dispatch (single branch point) | `src/services/email/mailDeliveryService.js` |
| Accounts + audit data | `src/models/emailAccountModel.js`, `src/models/emailProviderEventModel.js` |
| Schema | `src/migrations/044_email_accounts.sql` |

## OAuth flow

1. SPA calls `GET /api/integrations/gmail/connect?tier=send` (bearer JWT). The server
   stores a short-TTL (10 min), single-use `state` in Redis bound to the `userId`
   (the Google browser redirect carries no bearer token) and returns the consent URL.
2. Consent URL uses `access_type=offline`, `prompt=consent` (forces a refresh token),
   `include_granted_scopes=true`.
3. Google redirects to `GET /api/integrations/gmail/callback?code&state` (no auth).
   The server validates+consumes `state`, exchanges the code, reads the granted
   scopes + account identity, verifies `gmail.send` is present, encrypts the tokens,
   upserts `email_accounts`, and redirects to `${APP_BASE_URL}/setup?tab=email&gmail=connected`.
4. `GET /status` reports connection state; `POST /disconnect` revokes at Google and
   removes the row.

## Refresh-token reconnect edge case (must-handle)

Google returns a `refresh_token` **only on the first consent** (or when `prompt=consent`
forces re-issue). On reconnect/re-exchange it is frequently **absent**. Overwriting a
stored refresh token with `null` is a classic OAuth production bug that silently breaks
sending. We defend in two places:

- **Upsert** (`emailAccountModel.upsertOAuthAccount`): the refresh-token column uses
  `encrypted_refresh_token = COALESCE(EXCLUDED.encrypted_refresh_token, email_accounts.encrypted_refresh_token)`.
- **Refresh** (`oauthTokenService.refreshAndPersist` → `emailAccountModel.updateAccessToken`):
  only passes a new encrypted refresh token when Google actually returned one; otherwise
  `COALESCE($4, encrypted_refresh_token)` keeps the existing value.

Covered by tests: first connect stores it; reconnect without one preserves it; reconnect
with a new one rotates it; revocation (`invalid_grant`) marks the account `revoked` and
raises a non-retryable `ReauthRequiredError` prompting reconnect.

## Token lifecycle

`oauthTokenService.getFreshAccessToken(account)`:
- Returns the cached access token if it has >60s of life left.
- Otherwise acquires a **per-account Redis lock** (prevents a refresh stampede across
  concurrent send jobs), re-reads the account, refreshes via Google, persists the new
  access token + expiry, and records a `token_refreshed` event.
- On `invalid_grant` (revoked/expired grant) or a missing refresh token: marks the
  account `revoked`, records `token_revoked`, and throws `ReauthRequiredError`.

## Sending

`mailDeliveryService.send(userId, message)` is the **single** place transport branches:
- Resolves the sending account: a connected, send-capable Gmail account (when
  `GMAIL_SENDING_ENABLED` is on), else the SMTP app-password fallback.
- For Gmail: ensures a fresh token, calls `GmailProvider.sendEmail`, updates
  `email_accounts.last_used_at` (and resets `health_status` to `healthy`).
- On a Gmail send failure: flips `health_status` to `degraded` and tags the error with
  `emailAccountId`. Error classification lives in `src/queues/bullmqJobFailure.js`
  (`invalid_grant`/reauth → non-retryable; `429`/`rateLimitExceeded` → retryable).

The send worker (`src/workers/sendApplication.worker.js`) calls this once; the SMTP path
is byte-for-byte unchanged when `GMAIL_SENDING_ENABLED=false`.

## Security

- Refresh/access tokens encrypted at rest with **AES-256-GCM** (authenticated; tamper-evident),
  reusing `ENCRYPTION_KEY`. Legacy app passwords stay on AES-256-CBC.
- Tokens are never logged or stored in `email_provider_events.metadata`.
- `state` is single-use, short-TTL, bound to `userId`.
- Explicit disconnect revokes at Google; external revocation surfaces as `invalid_grant`.

## Free-trial usage tracking

The paywall loop (Upload Resume → Connect Gmail → Send → hit free limit → upgrade) is
powered by the existing `usage_counters` / entitlement stack — no new tables. Four
**lifetime** feature keys are seeded as DATA in `feature_definitions` (admin-editable, no
deploy): `free_trial_resumes_parsed` (2), `free_trial_jds_parsed` (10),
`free_trial_emails_generated` (10), `free_trial_applications_sent` (10). Paid plans
override to unlimited (`-1`). `usageService.enforceQuota` is atomic (single conditional
`INSERT ... ON CONFLICT ... WHERE`). Counts are recorded best-effort at real success
boundaries via `trialUsageService.record`. The frontend renders progress from
`getUsageSummary` (never hardcoded) in `TrialUsageProgress`.

## Configuration

Server (`.env`):

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=   # exact match of a console redirect URI
APP_BASE_URL=                # SPA base for the post-callback redirect
GMAIL_READ_TIER_ENABLED=false
GMAIL_SENDING_ENABLED=true   # rollout kill switch
```

Client (`client/.env`): `VITE_GMAIL_READ_TIER_ENABLED=true` to surface the (future) read option.

## Google verification & rollout

`gmail.send` is a **sensitive** scope: requires OAuth app verification (consent-screen
review, a published privacy policy URL describing Gmail data use, app homepage, demo
video, and a Google **Limited Use** compliance statement) but **no** annual third-party
security assessment.

`gmail.readonly` is a **restricted** scope: verification **plus** an annual independent
**CASA** assessment — which is why the read tier stays flag-gated and unrequested.

Rollout order:
1. Google Cloud project + OAuth consent screen (External), register **`gmail.send` only**,
   add the redirect URI and test users.
2. Run an internal beta in "Testing" mode (≤100 allow-listed users — full functionality).
3. Submit sensitive-scope (`gmail.send`) verification; publish the privacy policy +
   Limited Use disclosure.
4. Launch send-only to production.
5. (Separate future track) `gmail.readonly` + CASA → enable reply tracking / inbox sync
   behind `GMAIL_READ_TIER_ENABLED`.

### Privacy policy / Limited Use disclosure (draft language)

> OneTap uses Google Gmail authorization solely to **send** job application emails that
> you explicitly trigger, from your connected Gmail address. OneTap's use of information
> received from Google APIs adheres to the
> [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy),
> including the **Limited Use** requirements. We request the minimum scope necessary
> (`gmail.send`); we do **not** read, store, or transfer your email content or inbox.
> Refresh tokens are stored encrypted (AES-256-GCM) and used only to send mail on your
> behalf. You can disconnect at any time, which revokes OneTap's access at Google.
