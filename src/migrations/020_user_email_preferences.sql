ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_tone_level SMALLINT NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS email_structure_level SMALLINT NOT NULL DEFAULT 60;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS chk_users_email_tone_level;

ALTER TABLE users
  ADD CONSTRAINT chk_users_email_tone_level
    CHECK (email_tone_level BETWEEN 0 AND 100);

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS chk_users_email_structure_level;

ALTER TABLE users
  ADD CONSTRAINT chk_users_email_structure_level
    CHECK (email_structure_level BETWEEN 0 AND 100);
