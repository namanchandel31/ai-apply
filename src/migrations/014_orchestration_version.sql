-- Orchestration ordering: monotonic version + lifecycle epoch per application
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS orchestration_version BIGINT NOT NULL DEFAULT 0;

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS orchestration_epoch BIGINT NOT NULL DEFAULT 0;
