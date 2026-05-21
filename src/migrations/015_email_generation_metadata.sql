-- Email generation quality metadata and future feedback hooks (Phase 1 JSONB)
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS email_metadata JSONB,
  ADD COLUMN IF NOT EXISTS email_feedback_signals JSONB;
