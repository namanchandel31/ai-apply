-- =============================================================================
-- Migration 006: Email State Machine
-- Adds: ENUM type, state machine columns, dedicated SMTP tracking,
--        lifecycle timestamps, updated_at auto-trigger, and performance indexes.
-- Safe to re-run — all statements use IF NOT EXISTS / DO EXCEPTION guards.
-- =============================================================================

-- State machine enum.
-- 'abandoned' is the permanent failure terminal state (retry_count >= MAX_RETRIES).
DO $$ BEGIN
  CREATE TYPE app_email_status AS ENUM (
    'pending',
    'processing',
    'sent',
    'failed',
    'abandoned'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS email_status          app_email_status DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS retry_count           INT              DEFAULT 0,
  -- last_error: strictly for failure diagnostics. NEVER store SMTP message IDs here.
  ADD COLUMN IF NOT EXISTS last_error            TEXT,
  -- TEXT not JSONB: avoids malformed LLM output crashing the INSERT at the DB layer.
  -- Application layer enforces truncation to 5000 chars before persisting.
  ADD COLUMN IF NOT EXISTS llm_raw_output        TEXT,
  -- Dedicated SMTP provider message ID column. Populated by markSent().
  -- Foundation for future delivery tracking / outbox pattern migration.
  ADD COLUMN IF NOT EXISTS smtp_message_id       TEXT,
  -- updated_at: maintained automatically by trigger below (no app-layer writes needed).
  ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ DEFAULT NOW(),
  -- Lifecycle timestamps — written only by atomic transition queries, never by app logic.
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at             TIMESTAMPTZ;

-- NOTE: updated_at is maintained automatically by the trigger
-- 'update_applications_updated_at' already created in 005_indexes_and_constraints.sql.
-- No additional trigger needed here.

-- Index for fast email_status polling (status dashboards, admin queries).
CREATE INDEX IF NOT EXISTS idx_app_email_status
  ON applications(email_status);

-- Partial index on processing_started_at scoped only to 'processing' rows.
-- Keeps the stale recovery query O(stuck jobs), not O(all applications).
CREATE INDEX IF NOT EXISTS idx_app_processing_started
  ON applications(processing_started_at)
  WHERE email_status = 'processing';
