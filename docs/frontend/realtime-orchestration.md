# Realtime and orchestration

## Components

| Module | Role |
|--------|------|
| `RealtimeProvider` | Shared SSE connection |
| `orchestrationRegistry` | Per-app version state |
| `orchestrationTabLeader` | Leader election |
| `orchestrationBroadcast` | Multi-tab sync |
| `sseTransport` | Connect/reconnect |
| `shouldApplyEvent` | Stale event rejection |

## Hydration (leader tab)

1. `GET /api/orchestration/active`
2. `hydrateFromServer`
3. Drain buffer (max 50)
4. Open SSE

## Debug

`VITE_DEBUG=orchestration` — single scope (replaces per-subsystem `VITE_DEBUG_ORCHESTRATION_*`).

## Related Documentation

- [../architecture/realtime-architecture.md](../architecture/realtime-architecture.md)
- [../examples/sse-events.md](../examples/sse-events.md)
