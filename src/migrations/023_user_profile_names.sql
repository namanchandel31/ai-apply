-- Split display name into first/last for profile UI and applicant identity.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Backfill from existing full_name where possible.
UPDATE users
SET
  first_name = COALESCE(
    NULLIF(first_name, ''),
    NULLIF(split_part(trim(full_name), ' ', 1), '')
  ),
  last_name = COALESCE(
    NULLIF(last_name, ''),
    CASE
      WHEN position(' ' IN trim(full_name)) > 0
      THEN trim(substring(trim(full_name) FROM position(' ' IN trim(full_name)) + 1))
      ELSE NULL
    END
  )
WHERE full_name IS NOT NULL
  AND trim(full_name) <> ''
  AND (first_name IS NULL OR last_name IS NULL);
