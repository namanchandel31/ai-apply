# Authentication

AI Apply uses **Supabase Auth** with **Google OAuth** only. The API verifies Supabase access tokens via **JWKS** (`jose` + `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`).

## Flow

1. User signs in with Google in the SPA (`signInWithOAuth`).
2. Supabase returns a session; the client sends `Authorization: Bearer <access_token>` to the API.
3. `supabaseAuthMiddleware` verifies the JWT (issuer, audience, signature, expiration).
4. `userSyncService` upserts a local `users` row keyed by `supabase_user_id`.
5. `req.user.id` is the internal UUID used for all ownership checks.

## Endpoints

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/user/me` | Bearer (Supabase access token) |

Legacy `/auth/signup` and `/auth/login` are removed.

## Rules

- Never accept `userId` from the request body for authorization.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only (storage); never bundle in the client.
- Client uses `VITE_SUPABASE_ANON_KEY` only.
