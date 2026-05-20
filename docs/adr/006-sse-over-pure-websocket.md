# ADR-006: SSE over pure WebSocket

**Status:** accepted

## Context

Browsers need push updates for application status; JWT auth is required.

## Problem

- Native `EventSource` cannot set `Authorization` header easily.
- Full WebSocket adds infra complexity (sticky sessions, heartbeats, proxies).

## Decision

Use **SSE** over HTTP with `fetch` + `ReadableStream` on client for JWT support.

Optional Redis pub/sub for multi-instance API fan-out.

Polling remains fallback (3s / 30s intervals).

## Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| WebSocket + query token | Token leakage via logs/referrers |
| Long poll only | Higher latency and load |
| Pure poll | Poor UX for active applications |

## Tradeoffs

| Pro | Con |
|-----|-----|
| Works through many proxies | Unidirectional (sufficient today) |
| Reuse HTTP auth | Connection limits per browser tab |

## Operational implications

- Load balancers need reasonable SSE idle timeouts (> heartbeat 25s).
- Redis required for multi-node realtime consistency.

## Future considerations

- WebSocket for bidirectional features (chat, live editing).
- Adaptive poll backoff only (already partial).

## Related Documentation

- [../architecture/realtime-architecture.md](../architecture/realtime-architecture.md)
- [../frontend/realtime-orchestration.md](../frontend/realtime-orchestration.md)
