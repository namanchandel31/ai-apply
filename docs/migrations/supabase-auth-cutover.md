# Supabase Auth cutover

## Before any migration

1. **Take a full database backup** (required).
2. Record current legacy `users.id` and emails for both accounts.
3. Read [supabase-auth-legacy-user-linking.md](./supabase-auth-legacy-user-linking.md) and [supabase-auth-rollback.md](./supabase-auth-rollback.md).

## Supabase Dashboard

1. Enable **Google** provider only; disable email/password sign-in in Supabase when ready to cut over.
2. Add redirect URLs:
   - `http://localhost:5173/auth/callback` (dev)
   - Production app URL + `/auth/callback`
3. **Vite dev:** proxy only `/api` (and `/health`) to the backend — do **not** proxy `/auth/*`; `/auth/callback` is a React route handled by Supabase JS on the client.
3. Copy **Project URL**, **anon key** (frontend), **service role key** (backend storage only).

## Environment

| Variable | Where |
|----------|--------|
| `SUPABASE_URL` | Backend + `VITE_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend storage only |
| `VITE_SUPABASE_ANON_KEY` | Frontend only |

JWT verification uses JWKS (`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`).

## Migration phases

| Migration | When | What it does |
|-----------|------|----------------|
| `017_supabase_auth_users.sql` | Deploy auth code | Adds nullable `supabase_user_id`, profile columns; **no deletes**; keeps `password_hash` |
| Manual SQL | After each legacy user signs in with Google once | `UPDATE users SET supabase_user_id = ...` on **existing** `id` |
| `018_supabase_auth_finalize.sql` | After verification checklist passes | Drops `password_hash`, `NOT NULL` on `supabase_user_id` |

**Do not run `018` until both legacy users are linked and verified.**

## Data preservation rules

- **Never** `DELETE FROM users` or truncate `users` for auth migration.
- **Never** change existing `users.id` — all `applications`, `resumes`, `jobs`, and events keep the same FK ownership.
- Supabase `sub` maps only to `users.supabase_user_id`; business logic uses `req.user.id` (internal UUID).

## If you already ran a destructive `017`

If an earlier version of `017` deleted rows or dropped `password_hash`, **restore from backup** before continuing. The current `017` is non-destructive only.

## Future RLS

When using Supabase Postgres, policies can reference `auth.uid() = users.supabase_user_id`. Until then, the API enforces ownership via verified JWT + internal `users.id`.
