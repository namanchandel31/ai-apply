# Runbook: Redis down

## Symptoms

- BullMQ connection errors
- Enqueue failures on auto-apply
- Multi-instance SSE stops cross-node fan-out

## Debug

1. Check Redis process / cloud console
2. `REDIS_URL` correct?
3. API and worker logs: `AggregateError ECONNREFUSED`

## Fix

1. Restore Redis availability
2. Restart API and workers
3. Run recovery for stuck `application_jobs`
4. Verify `curl .../internal/queue-health`

## Related Documentation

- [../../observability/queue-monitoring.md](../../observability/queue-monitoring.md)
