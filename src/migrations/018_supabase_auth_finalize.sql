-- Phase 2 (run manually after legacy user linking verification only).
-- See docs/migrations/supabase-auth-legacy-user-linking.md
--
-- Prerequisites:
--   1. DB backup taken before 017/018
--   2. Every user who should access the app has supabase_user_id set
--   3. Manual verification checklist completed for all legacy users

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE supabase_user_id IS NULL) THEN
    RAISE EXCEPTION
      '018_supabase_auth_finalize blocked: users.supabase_user_id IS NULL for one or more rows. '
      'Complete manual Google linking before running this migration.';
  END IF;
END $$;

ALTER TABLE users DROP COLUMN IF EXISTS password_hash;

ALTER TABLE users
  ALTER COLUMN supabase_user_id SET NOT NULL;
