-- User apply mode: auto_apply sends immediately after generation; review_apply stops at Ready.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_apply_mode') THEN
    CREATE TYPE user_apply_mode AS ENUM ('auto_apply', 'review_apply');
  END IF;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS apply_mode user_apply_mode NOT NULL DEFAULT 'review_apply';
