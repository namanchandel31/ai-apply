# Realtime recovery contract (v1)

## Scope

Defines client/server behavior after SSE disconnect, Redis bounce, API restart, and missed events. v1 uses hydrate-on-reconnect as the authoritative catch-up path.

## Publish durability limits (operational risk #1)

The post-commit publish queue (`src/realtime/postCommitPublishQueue.js`) is **in-memory only**.

| Scenario | Guarantee |
|----------|-----------|
| After successful `COMMIT` + `await flushPostCommitPublishes()` | Publish runs before worker returns (normal path) |
| Worker crash after `COMMIT`, before flush | Best-effort orphan sweep on **same process** only |
| Full API/worker process restart | Committed-but-unflushed publishes may be **lost** until the next DB mutation |
| Separate worker process died | No shared queue; healing via next state transition or manual retry |

**Not guaranteed:** at-least-once publish across restarts. Do not describe v1 as a transactional outbox.

### Future migration (documented, not implemented)

1. `application_outbox` table (same transaction as state change) + async relay worker
2. Redis Stream / Kafka with consumer groups
3. `postCommitPublishQueue` becomes a thin insert wrapper; enqueue API remains stable

## Client recovery

1. Leader tab reconnects SSE after hydrate.
2. `lastSeenVersion` / `lastSeenEpoch` tracked per application in the orchestration registry.
3. Hydrate from `/orchestration/active` is authoritative when event gaps are suspected.
4. Stale watchdog (`MAX_STALE_CONVERGENCE_MS`) runs heal hierarchy: hydrate → poll → forced invalidate (suppression does not block per-row heal).

## Invalidate suppression

`CACHE_INVALIDATE_SUPPRESSED` (30s after invalidate storm) blocks **bulk** list invalidates only. It does **not** block SSE apply, poll patches, or stale watchdog per-row recovery.

## Log chain (grep)

`REALTIME_PUBLISH_SCHEDULED` → `REALTIME_PUBLISH_FLUSHED` → `REALTIME_PUBLISH_EMITTED` → `REDIS_*` / `REALTIME_LOCAL_FANOUT` → `SSE_EVENT_SENT` → client `SSE_EVENT_APPLIED` / `SSE_EVENT_REJECTED`
