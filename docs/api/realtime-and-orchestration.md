# Realtime and orchestration API

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/realtime/stream` | SSE, JWT |
| GET | `/api/orchestration/active` | Snapshot for hydration |

## SSE

Use fetch stream client-side. Events: `application.updated`, heartbeat comments.

## Related Documentation

- [../architecture/realtime-architecture.md](../architecture/realtime-architecture.md)
- [../examples/sse-events.md](../examples/sse-events.md)
