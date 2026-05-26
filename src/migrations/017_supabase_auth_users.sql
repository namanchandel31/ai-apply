-- Phase 1 (non-destructive): add Supabase identity columns; preserve all existing users rows.
-- Do NOT delete, truncate, or modify existing users.id values.
-- Manual legacy linking + verification: docs/migrations/supabase-auth-legacy-user-linking.md
-- Phase 2 (NOT NULL, drop password_hash): run 018 only after manual verification.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS supabase_user_id UUID,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS profile_customized_at TIMESTAMPTZ;

-- Multiple NULL supabase_user_id values allowed (legacy rows); each non-null value unique.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_supabase_user_id ON users (supabase_user_id);
