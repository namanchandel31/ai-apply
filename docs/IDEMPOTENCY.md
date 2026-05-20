# Idempotency

## BullMQ job IDs

| Queue | Deterministic ID |
|-------|------------------|
| Process | `process:application:{applicationId}` |
| Send | `send:application:{applicationId}` |

Re-enqueue while a job is `waiting`, `delayed`, or `active` is a no-op.

## Continue

`Idempotency-Key` or `X-Idempotency-Key` header deduplicates continue requests for 60 seconds per key.

## Send / state

- `hasCompletedSendJob` prevents duplicate SMTP after a completed send job.
- `markSentFromGenerated` uses CAS (`generated` → `sent`) so only one worker wins.

## Recovery

Stuck `application_jobs` are re-enqueued; applications in `needs_review` or with `review_reason` are skipped.
