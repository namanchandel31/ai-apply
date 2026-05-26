# Supabase auth pre-merge audit checklist

## Code / security

- [ ] No `authRoutes`, `authService`, `authController`, `authMiddleware` files or imports
- [ ] No `JWT_SECRET` / symmetric secret in production JWT verify path
- [ ] No `ai_apply_token` or auth tokens in `localStorage`
- [ ] No `api.signup` / `api.login` in client
- [ ] Grep: no `userId` from `req.body` / `req.query` for ownership
- [ ] `SUPABASE_SERVICE_ROLE_KEY` absent from client bundle / Vite env
- [ ] All protected `/api/*` routes use `supabaseAuthMiddleware`
- [ ] JWKS verifier validates issuer + audience + expiration
- [ ] `userSyncService` resolves by `supabase_user_id` first (no duplicate on manual link)
- [ ] Unmapped legacy email blocks auto-insert (`LEGACY_USER_PENDING_MANUAL_LINK`)
- [ ] Profile sync: email from IdP; name/avatar only when NULL unless `profile_customized_at`
- [ ] SSE 401 triggers sign-out, not reconnect
- [ ] `GET /api/user/me` returns internal id from `req.user`
- [ ] Auth logs contain no raw tokens
- [ ] Orchestration/application services have no Supabase auth imports

## Database (phased)

- [ ] Backup taken before `017` ([rollback doc](./supabase-auth-rollback.md))
- [ ] `017` applied — nullable `supabase_user_id`, **no** `DELETE FROM users`
- [ ] `password_hash` still present until `018`
- [ ] Legacy users manually linked ([linking doc](./supabase-auth-legacy-user-linking.md))
- [ ] `018` applied only after per-user verification
- [ ] `password_hash` dropped after `018`
- [ ] `supabase_user_id NOT NULL` after `018`

## Per legacy user (×2)

See [supabase-auth-legacy-user-linking.md](./supabase-auth-legacy-user-linking.md).
