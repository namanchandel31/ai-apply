-- 012_recovery_indexes.sql
-- Partial indexes for recovery queries (findRecoverableStuckQueuedJobs / findRecoverableStuckProcessingJobs).
-- Requires 011b (idx_app_jobs_application on application_id, created_at DESC already exists — not duplicated).
--
-- EXPLAIN validation (dev, 2026-05-19): run against findRecoverableStuck* SQL with realistic data;
-- expect index scans on idx_app_jobs_latest_queued / idx_app_jobs_processing_started where filters match.

CREATE INDEX IF NOT EXISTS idx_app_jobs_latest_queued
  ON application_jobs (application_id, job_type, created_at DESC)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS idx_app_jobs_processing_started
  ON application_jobs (status, started_at)
  WHERE status = 'processing';
