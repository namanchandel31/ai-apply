# Runbook: Stuck jobs

## Symptoms

- `application_jobs.status = processing` for extended period
- BullMQ job active but no progress logs

## Debug

1. `GET /internal/queue-health`
2. Redis CLI: inspect queue lengths
3. DB: latest job row for `application_id`
4. Worker process running?

## Fix

1. Restart worker process
2. Trigger recovery job (if scheduled) or manual re-enqueue with same deterministic ID
3. If terminal corruption — user `retry` endpoint
4. Never set `sent` manually without CAS

## Related Documentation

- [../../examples/recovery-scenarios.md](../../examples/recovery-scenarios.md)
