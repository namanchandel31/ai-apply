# Retry flow examples

**Source:** `applicationCommandService`, BullMQ retry, `recovery.job.js`.

## User retry (business failed)

1. `application_status` = `failed`
2. `POST /api/applications/:id/retry`
3. New `application_jobs` row (`ai_process` or `send_email`)
4. New deterministic BullMQ job (no-op if already active)
5. `application_status` may move to `draft` or `generated` depending on path

## BullMQ attempt retry

1. Worker throws retryable error
2. Job attempt N < max attempts
3. Exponential backoff (send: 5 attempts, process: 3)
4. Same `application_jobs` row moves `processing` → `retrying` → `processing` or `failed`

## Recovery job

1. Cron/scheduled `recovery.job.js` finds stuck `queued`/`processing` jobs
2. Re-enqueue with same deterministic ID
3. Skips applications in `needs_review` with `review_reason`

## Related Documentation

- [../queues/retry-and-backoff.md](../queues/retry-and-backoff.md)
- [../backend/failure-recovery.md](../backend/failure-recovery.md)
