# Supabase auth migration — rollback

Even with only two legacy users, take a backup before `017` and know how to roll back.

## Before migration

```bash
# Example: pg_dump (adjust connection string)
pg_dump "$DATABASE_URL" -Fc -f ai_apply_pre_supabase_auth.dump
```

Store the dump off-host. Record:

- Both `users.id` values
- Emails and row counts for `applications`, `resumes` per user

## Roll back application code

1. Deploy the previous git revision (pre–Supabase OAuth) if needed.
2. Restore env: re-enable `JWT_SECRET` if the old stack required it.
3. Point frontend back to email/password login if rolling back UI.

## Roll back database

### If `018` was **not** applied

Restore is simpler — `017` only added nullable columns:

```sql
-- Optional: remove Supabase columns (only if no production data depends on them yet)
ALTER TABLE users
  DROP COLUMN IF EXISTS profile_customized_at,
  DROP COLUMN IF EXISTS last_login_at,
  DROP COLUMN IF EXISTS avatar_url,
  DROP COLUMN IF EXISTS full_name,
  DROP COLUMN IF EXISTS supabase_user_id;

DROP INDEX IF EXISTS uniq_users_supabase_user_id;
```

If you already manually set `supabase_user_id`, clearing it returns the row to legacy-only state (password auth only works if `password_hash` still exists).

### If `018` was applied (`password_hash` dropped)

**Restore from `pg_dump` backup.** Column drops and `NOT NULL` are not safely reversible without backup.

```bash
# Example restore (destructive to current DB — use a staging clone first)
pg_restore -d "$DATABASE_URL" --clean --if-exists ai_apply_pre_supabase_auth.dump
```

### If a destructive `017` deleted users

**Only recovery path is full restore from backup.** Do not attempt to recreate `users.id` without restoring FK data — UUIDs must match prior values.

## After rollback verification

- [ ] Legacy users can authenticate (old method) or data visible as expected
- [ ] Application counts per `user_id` match pre-migration notes
- [ ] No orphaned applications without owning user row
