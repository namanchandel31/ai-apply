-- PostgreSQL requires new enum values to be committed before use in indexes/DML.
-- Run in a separate migration file (before 007_auto_apply.sql).
ALTER TYPE app_email_status ADD VALUE IF NOT EXISTS 'queued';
ALTER TYPE app_email_status ADD VALUE IF NOT EXISTS 'needs_review';
