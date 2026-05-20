# Orchestration runtime

## Registry hydration handshake

On connect/reconnect (leader tab only):

1. `GET /api/orchestration/active` — authoritative snapshot (`version`, `orchestrationEpoch`, `terminal`, `pollable`, `updatedAt`)
2. `registry.hydrateFromServer(states)`
3. Drain pre-hydration SSE buffer
4. Open SSE stream

SSE events received before hydration complete are buffered (max 50), not applied.

## Multi-tab coordination

- **Leader election**: `localStorage` lease `ai-apply-orchestration-leader` (5s TTL, 2s heartbeat)
- **Leader tab**: hydration + SSE transport
- **Follower tabs**: registry sync via `BroadcastChannel` (`ai-apply-orchestration`)
- Messages: `revive`, `terminal`, `invalidate`, `event`, `leader_claim`, `leader_release`

## Version invariants

Only `transitionApplicationState()` mutates `orchestration_version` / `orchestration_epoch`:

| `orchestrationBump` | Effect |
|---------------------|--------|
| `none` (default) | `version++` after successful status CAS |
| `revive` | `epoch++`, `version++` (no status CAS) |
| `revive_with_transition` | CAS then single `epoch++`, `version++` |

Regression guard: DB monotonic violations → `VERSION_REGRESSION_FATAL` (immediate error). Client stale replays → debug when `DEBUG_ORCHESTRATION_RECONCILIATION=1`; repeated rejects → deduped `VERSION_REGRESSION_DETECTED` warn.

## Reconciliation

`shouldApplyEvent` rejects stale version/epoch/updatedAt and passive terminal resurrection.

Self-heal: repeated rejects or impossible apply → `registry.invalidate` + re-hydrate.

Reject metrics: `orchestration.reconcile.reject` (tags: reason). Deduped warns: `EVENT_REJECTED_*`, `VERSION_REGRESSION_DETECTED`. Deep detail only with `VITE_DEBUG_ORCHESTRATION_RECONCILIATION=1`.

## Terminal hard stop

Terminal apps: no poll membership, no SSE apply after prune, backend `REALTIME_TERMINAL_SKIP`.

## Logging policy

| Level | When | Examples |
|-------|------|----------|
| **debug** | `DEBUG_ORCHESTRATION_*` / `VITE_DEBUG_ORCHESTRATION_*` | buffer drain, hydration internals, harmless replay, transport lifecycle |
| **info** | Operational milestones (state-change only) | `WORKER_READY`, `RETRY_TRIGGERED`, `SSE_RECONNECTED` after stable recovery |
| **warn** | Recoverable anomalies (deduped) | `RECONNECT_STORM`, `STATUS_POLL_SLOW*`, repeated stale regression |
| **error** | Hard failure | `VERSION_REGRESSION_FATAL`, `HYDRATION_FAILED`, queue/DB crash |

**State-change rule:** no log unless state meaningfully changed or dedupe window threshold crossed.

### Debug flags (standard namespace)

| Backend | Frontend (Vite) | Component |
|---------|-----------------|-----------|
| `DEBUG_ORCHESTRATION_REALTIME` | `VITE_DEBUG_ORCHESTRATION_REALTIME` | realtime |
| `DEBUG_ORCHESTRATION_RECONCILIATION` | `VITE_DEBUG_ORCHESTRATION_RECONCILIATION` | reconciliation |
| `DEBUG_ORCHESTRATION_HYDRATION` | `VITE_DEBUG_ORCHESTRATION_HYDRATION` | hydration |
| `DEBUG_ORCHESTRATION_TRANSPORT` | `VITE_DEBUG_ORCHESTRATION_TRANSPORT` | transport |
| `DEBUG_ORCHESTRATION_LEADER` | `VITE_DEBUG_ORCHESTRATION_LEADER` | leader |
| `DEBUG_ORCHESTRATION_POLL` | `VITE_DEBUG_ORCHESTRATION_POLL` | poll |

Parser: `src/utils/debugFlags.js`, `client/src/services/logging/debugFlags.ts`.

### Dedupe bounds

`LOG_DEDUPE_WINDOW_MS` (default 60s), `LOG_DEDUPE_BUCKET_TTL_MS` (120s), `LOG_DEDUPE_MAX_BUCKETS` (500). Diagnostics: `orchestrationDedupe.getStats()` → `{ activeBucketCount, evictedBucketCount, dedupeMemoryUsageEstimate }`.

### Metrics hooks (no vendor coupling)

`src/observability/orchestrationMetrics.js`, `client/src/services/logging/metricsHooks.ts` — `increment`, `histogram`, `gauge` (no-op/in-memory default).

| Metric | Source |
|--------|--------|
| `orchestration.reconcile.reject` | client reconciliation |
| `orchestration.reconnect.attempt` | SSE transport |
| `orchestration.hydration.duration_ms` | hydration endpoint + client hydrate |
| `orchestration.leader.conflict` | tab leader loss |
| `orchestration.sse.connections` | connection registry gauge |
| `orchestration.version.regression` | versionRegression (tag: regressionType) |

High-frequency paths increment metrics first; logs only on dedupe summary or milestone.

### Reconnect storm

Leader SSE transport: reconnect attempts counted; ≥5 in window → one `RECONNECT_STORM` warn; stable `connected` (2s hysteresis) → single `SSE_RECONNECTED` info. `RECONNECT_BACKOFF` never per-attempt — deduped warn only.

## Module initialization

Dependency cycles are forbidden under `src/`. See [RUNTIME.md](./RUNTIME.md) for boundary rules and the external `url.parse()` deprecation note.

## CI test scope

Default `npm test` runs unit + orchestration suites with green signal. Excluded (need live DB/auth/harness):

- `tests/jdParser.unit.test.js` (migrate mocks to `aiGateway`)
- `tests/*integration.test.js` (auth)
- `tests/security.test.js` (manual)
- `tests/middleware/uploadMiddleware.test.js`
- `tests/resumeController.unit.test.js` (legacy controller exports)
