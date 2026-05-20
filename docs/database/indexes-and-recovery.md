# Indexes and recovery

Partial indexes support recovery and status polling hot paths.

## Recovery (012)

Indexes on `application_jobs` for:

- Latest `queued` per application
- Stuck `processing` (with `started_at`)

Used by [`recovery.job.js`](../../src/jobs/recovery.job.js).

## Status poll (013)

`idx_app_jobs_app_type_created` — latest job per type for poll bundle queries.

## Application recovery candidates

`idx_app_recovery_candidates` — partial index on applications eligible for recovery scan.

## Query guidance

- Always filter `application_id` + `job_type` + `ORDER BY created_at DESC LIMIT 1` for latest job.
- Avoid full table scan on `application_events` for automation — use jobs + business status.

## Related Documentation

- [../examples/recovery-scenarios.md](../examples/recovery-scenarios.md)
- [../troubleshooting/runbooks/stuck-jobs.md](../troubleshooting/runbooks/stuck-jobs.md)
