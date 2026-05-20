# Queue scaling

## Current model

| Knob | Value |
|------|-------|
| process concurrency | 2 per worker process |
| send concurrency | 3 per worker process |
| Scale method | More `npm run worker` replicas |

Concurrency is **code-only** — not env vars.

## Future (documented intent)

| Direction | When |
|-----------|------|
| Separate Redis per queue tier | High send volume |
| Priority queues | Paid tier faster send |
| Partition by `userId` hash | Multi-tenant fairness |

See [../roadmap/future-architecture.md](../roadmap/future-architecture.md).

## Related Documentation

- [../deployment/architecture.md](../deployment/architecture.md)
- [../workers/bootstrap-and-isolation.md](../workers/bootstrap-and-isolation.md)
