# Recovery scenarios

**Source:** [`recovery.job.js`](../../src/jobs/recovery.job.js).

## Stuck processing job

| Symptom | `application_jobs.status` = `processing` for > threshold |
|---------|----------------------------------------------------------|
| Action | Recovery re-enqueues `process:application:{id}` |
| Skip | `needs_review` + `review_reason` set |

## Stuck send job

| Symptom | `send_email` queued but no worker progress |
|---------|---------------------------------------------|
| Action | Re-enqueue `send:application:{id}` if no completed send job |

## After recovery

- New BullMQ attempt uses same deterministic ID (dedup if already active)
- Logs: `RECOVERY_SKIP_NO_EMAIL`, `RECOVERY_QUEUE_METRICS`

## Related Documentation

- [../database/indexes-and-recovery.md](../database/indexes-and-recovery.md)
- [../troubleshooting/runbooks/stuck-jobs.md](../troubleshooting/runbooks/stuck-jobs.md)
