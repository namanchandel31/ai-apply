# Realtime SSE status updates

## Flow

```
Worker / API command
  → transitionJobState / transitionApplicationState (DB CAS)
  → scheduleApplicationRealtimePublish (after persist)
  → publishApplicationUpdate (read bundle + serialize)
  → fanOut (Redis pub/sub or in-process EventEmitter)
  → SSE gateway → connected browser tabs
```

Workers do not import SSE code. They only trigger transitions; the publisher runs after DB writes.

## Endpoint

`GET /api/realtime/stream` — requires `Authorization: Bearer <JWT>`.

Uses `fetch` + `ReadableStream` on the client (not `EventSource`) so the JWT header works without query tokens.

## Transport

| Mode | When | Path |
|------|------|------|
| Redis | `REDIS_URL` set and `REALTIME_REDIS` ≠ `0` | Worker/API publish → Redis channel → API SSE gateway |
| Local | No Redis | `realtimeBus` EventEmitter in API process only |

Default channel: `ai-apply:realtime` (`REALTIME_REDIS_CHANNEL` override).

## Frontend

- `RealtimeProvider` — one shared SSE connection per logged-in session
- `ApplicationTable` — applies `application.updated` patches to local state
- `useApplicationStatusPoll` — 30s fallback interval when `sseActive`; 3s when disconnected

## Logs

- `REALTIME_EVENT_EMITTED`
- `SSE_CLIENT_CONNECTED` / `SSE_CLIENT_DISCONNECTED`
- `SSE_EVENT_SENT`
- `SSE_CONNECTION_COUNT`
- `SSE_GATEWAY_STARTED`
