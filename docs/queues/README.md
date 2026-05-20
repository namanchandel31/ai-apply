# Queues

BullMQ on Redis.

| Doc | Topic |
|-----|-------|
| [bullmq-architecture.md](bullmq-architecture.md) | Components |
| [job-lifecycle.md](job-lifecycle.md) | States |
| [retry-and-backoff.md](retry-and-backoff.md) | Retry policy |
| [deterministic-ids.md](deterministic-ids.md) | Job IDs |
| [scaling.md](scaling.md) | Horizontal scale |

## Queue map

| BullMQ name | DB job_type |
|-------------|-------------|
| `process-application` | `ai_process` |
| `send-application` | `send_email` |

## Related Documentation

- [../workers/README.md](../workers/README.md)
- [../architecture/async-processing.md](../architecture/async-processing.md)
