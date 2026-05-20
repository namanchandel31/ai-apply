# Queue monitoring

## Startup logs

`QUEUE_SYSTEM_READY`, `WORKER_BOOTED`, `WORKER_READY`, `WORKER_CONNECTED`

## Per job

`JOB_RECEIVED`, `JOB_STARTED`, `JOB_COMPLETED`, `JOB_FAILED`, `JOB_STALLED`, `JOB_RETRIED`

## Internal health

```bash
curl -H "x-internal-api-key: $INTERNAL_API_KEY" \
  http://localhost:5000/internal/queue-health
```

Returns waiting/active/failed per queue — [`queueHealthService.js`](../../src/services/queueHealthService.js).

## Recovery metrics

`RECOVERY_QUEUE_METRICS` in recovery job logs.

## Related Documentation

- [../queues/bullmq-architecture.md](../queues/bullmq-architecture.md)
- [operational-playbooks.md](operational-playbooks.md)
