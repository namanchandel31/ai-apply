# BullMQ architecture

Redis connection from [`queues/connection.js`](../../src/queues/connection.js) using `config.redis.redisUrl`.

## Components

| Piece | Role |
|-------|------|
| `Queue` | Producer (API, recovery) |
| `Worker` | Consumer (`src/workers/`) |
| `connection` | Shared ioredis |

## Validation

`validateQueueSystem.js` runs at startup — strict in production (`queueValidationStrict()`).

## Health

`GET /internal/queue-health` — waiting/active/failed counts per queue.

## Related Documentation

- [job-lifecycle.md](job-lifecycle.md)
- [../observability/queue-monitoring.md](../observability/queue-monitoring.md)
