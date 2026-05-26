# Manual legacy user linking (2 users)

Use this checklist **per legacy user**. No automated migration tooling — manual SQL only.

## Why manual linking

- Preserve existing `users.id` and all owned data (applications, resumes, jobs, events).
- Avoid duplicate local user rows when Google sign-in happens before mapping.
- The API **blocks** auto-creation of a new user when Google email matches exactly one unmapped legacy row (`LEGACY_USER_PENDING_MANUAL_LINK`).

## Per-user procedure

### 1. Pre-flight

- [ ] DB backup completed
- [ ] Note internal id: `users.id = __________________`
- [ ] Note legacy email on row: `__________________`

### 2. Google sign-in (once)

- [ ] User completes **Continue with Google** in the app
- [ ] In Supabase Dashboard → **Authentication** → **Users**, confirm new `auth.users` row exists
- [ ] Copy Supabase user UUID (`sub`): `__________________`
- [ ] Confirm Google email: `__________________`

If the app shows an error about pending manual link, that is expected until step 3 completes.

### 3. Manual link (preserve internal id)

Run against your app database (replace placeholders):

```sql
UPDATE users
SET
  supabase_user_id = '00000000-0000-0000-0000-000000000000',  -- Supabase auth.users id
  email = 'user@gmail.com'                                      -- Google email if changed
WHERE id = '00000000-0000-0000-0000-000000000001';              -- existing internal users.id
```

**Do not** `INSERT` a new `users` row. **Do not** change `users.id`.

### 4. Verification

- [ ] User signs in again with Google — no duplicate-user error
- [ ] `GET /api/user/me` returns the **same** internal `id` as before linking
- [ ] Applications list shows historical applications
- [ ] Resumes / setup status unchanged
- [ ] Realtime/SSE connects (dashboard applications update live)
- [ ] Sign out → sign in again — data still present
- [ ] Query confirms single row:

```sql
SELECT id, supabase_user_id, email FROM users WHERE id = '...';
```

```sql
-- Should return zero rows for this Supabase id on any other internal id
SELECT id FROM users WHERE supabase_user_id = '...' AND id <> '...';
```

### 5. Finalize (after **all** legacy users pass step 4)

- [ ] Run `npm run migrate` to apply `018_supabase_auth_finalize.sql` only when every active user has `supabase_user_id` set
- [ ] Confirm `password_hash` column removed
- [ ] Confirm no `users` rows with `supabase_user_id IS NULL` that still need access

## New Google users (not legacy)

Users who were never in `users` before cutover: first successful API call creates a new row via `userSyncService` with a new internal `id`. No manual step.

## Internal ownership model (unchanged)

| Layer | Identity |
|-------|----------|
| Supabase JWT `sub` | `users.supabase_user_id` |
| API `req.user.id` | `users.id` (internal UUID) |
| `applications.user_id`, `resumes.user_id`, etc. | internal UUID only |
