# Realtime scope boundaries

Pragmatic SSE-only orchestration UI — not a generalized realtime platform.

## What this system IS

- SSE-driven job application status updates
- Leader-tab SSE with passive follower mirrors
- Bounded replay (30m Redis Stream + MAXLEN ~10k)
- Fixed 75ms event batching and hard queue caps

## What this system IS NOT

- Kafka-scale event platform, full event sourcing, or infinite replay
- Collaborative editing (multiplayer coordination)
- Adaptive batching, adaptive circuit breakers, or follower-owned recovery

## Replay retention tradeoffs

- **30 minutes** time window + **~10k** events per user stream
- Outside window: `REPLAY_EXPIRED` → Tier 3 bootstrap hydrate (intentional)
- `eventId` is transport cursor only; `orchestration_version` is business truth

## Follower tabs are passive mirrors

- Only the leader owns SSE, hydrate, replay, and convergence heal
- Followers receive post-batch `state_patch` via BroadcastChannel
- No follower replay, reconnect, or orchestration recovery

## Fixed flush interval decision

- **75ms** fixed (`EVENT_BATCH_FLUSH_MS`) — no adaptive tuning in v1
- Coalesce by `applicationId`; highest `version` wins per flush

## Minimal degraded UX philosophy

- After 3 Tier-3 failures in 5 minutes: `REALTIME_DEGRADED_MODE`
- Simple banner + manual “Refresh status” — no recovery dashboard

## Metrics prioritization

Ship: `replay_miss_count`, `tier3_replay_expired`, `sse.zombie_reaped`, `recovery.tier2_count`, `realtime.degraded_mode_count`

Defer: per-phase batch histograms, granular replay trim analytics

## Simple recovery guard philosophy

- Tier 1: replay via `Last-Event-ID` (< 60s disconnect)
- Tier 2: max **50** targeted status fetches (5 concurrent, 200ms gap)
- Tier 3: single `GET /api/orchestration/active` with 3-attempt / 5m cooldown

## Query performance targets (local/light load)

- Simple indexed reads: under 20ms
- `status_bundle`: under 50ms p95 (see migration `015_status_bundle_indexes.sql`)
- Slow status queries log `QUERY_EXPLAIN_SLOW` when `DEBUG=query` or non-production

## Publish correctness (v2)

- Dedupe key: `(applicationId, orchestration_version, orchestration_epoch)` — not `status:updatedAt`
- Server 75ms publish batch coalesces post-commit flushes
- Job transitions bump `orchestration_version` before publish

See also: [realtime-ordering.md](./realtime-ordering.md), [realtime-failure-scenarios.md](./realtime-failure-scenarios.md), [request-lifecycle.md](./request-lifecycle.md)
