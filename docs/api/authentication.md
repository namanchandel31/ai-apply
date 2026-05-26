# API authentication

All protected routes require:

```
Authorization: Bearer <supabase_access_token>
```

Obtain the access token from the Supabase client session after Google sign-in.

## Profile

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/user/me` | Current user profile (internal id, email, flags) |

## Verification (server)

- JWKS at `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`
- Issuer: `{SUPABASE_URL}/auth/v1`
- Audience: `authenticated`
- Email verification: `email_confirmed_at`, `email_verified`, or OAuth `app_metadata.provider` (Google and other IdPs)

API auth error codes include `TOKEN_EXPIRED`, `INVALID_TOKEN`, `EMAIL_NOT_VERIFIED`, and legacy linking `LEGACY_USER_PENDING_MANUAL_LINK` (403).
