-- =============================================================================
-- Migration 007: Denormalized JD fields for queries and send flow
-- Parsed contact/company fields are copied onto job_descriptions at insert time
-- so send and list queries do not need JSONB joins.
-- Safe to re-run — uses IF NOT EXISTS.
-- =============================================================================

ALTER TABLE job_descriptions
  ADD COLUMN IF NOT EXISTS company_name   TEXT,
  ADD COLUMN IF NOT EXISTS contact_person TEXT,
  ADD COLUMN IF NOT EXISTS contact_email  TEXT,
  ADD COLUMN IF NOT EXISTS location       TEXT,
  ADD COLUMN IF NOT EXISTS job_type       TEXT;

-- Backfill from latest parsed row per JD (existing databases)
UPDATE job_descriptions jd
SET
  company_name    = COALESCE(jd.company_name,    sub.company_name),
  contact_person  = COALESCE(jd.contact_person,  sub.contact_person),
  contact_email   = COALESCE(jd.contact_email,   sub.contact_email),
  location        = COALESCE(jd.location,        sub.location),
  job_type        = COALESCE(jd.job_type,        sub.job_type),
  title           = COALESCE(jd.title,           sub.job_title)
FROM (
  SELECT DISTINCT ON (job_description_id)
    job_description_id,
    NULLIF(parsed_json->>'company_name', '')    AS company_name,
    NULLIF(parsed_json->>'contact_person', '')  AS contact_person,
    NULLIF(parsed_json->>'contact_email', '')     AS contact_email,
    NULLIF(parsed_json->>'location', '')         AS location,
    NULLIF(parsed_json->>'job_type', '')          AS job_type,
    NULLIF(parsed_json->>'job_title', '')         AS job_title
  FROM parsed_job_descriptions
  ORDER BY job_description_id, created_at DESC
) sub
WHERE jd.id = sub.job_description_id;

CREATE INDEX IF NOT EXISTS idx_jd_contact_email ON job_descriptions(contact_email)
  WHERE contact_email IS NOT NULL;
