-- Admin flag for users. Toggled manually in the DB; gates the web Admin console
-- (extension detection config + AI model promotion) and the isAdmin field on /me.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
