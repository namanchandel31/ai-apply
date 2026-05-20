# Status endpoint latency report

## Summary

| Area | Change |
|------|--------|
| DB round-trips | 3 → 1 (`getApplicationStatusBundle` with LATERAL joins) |
| Conditional GET | `ETag` + `If-None-Match` → `304` skips JSON body + `serializeApplication` on unchanged state |
| Index | `idx_app_jobs_app_type_created` on `(application_id, job_type, created_at DESC)` |
| Observability | `DB_QUERY` / `DB_QUERY_SLOW`, `POOL_METRICS`, `STATUS_POLL_*` tiered thresholds |

## Root cause (appQueryMs spikes)

Primary suspect for **~2s `appQueryMs` on PK-filtered reads** is **connection pool wait** or **remote DB RTT**, not sequential scans on `applications.id`.

Evidence:

- Snapshot query filters `WHERE id = $1 AND user_id = $2` (PK on `id`).
- Existing `idx_app_id_user` in migration 005.
- Spikes correlate with concurrent workers + multi-app polling on `max: 10` pool.

**Confirm locally:** compare `DB_QUERY.durationMs` vs `poolWaiting` in logs during spikes. Run `node scripts/checkDbContention.js` while workers/recovery are active.

## EXPLAIN ANALYZE

Generate plans against your dev database:

```bash
node scripts/explainStatusQueries.js [applicationId] [userId]
```

Output: [status-query-plans.md](./status-query-plans.md)

**Expected after migration 013:**

- `applications`: Index Scan or primary key lookup on `id`
- `application_jobs` LATERAL arms: Index Scan using `idx_app_jobs_app_type_created`
- No `Seq Scan` on hot paths at modest row counts

Apply migration:

```bash
npm run migrate
```

## Indexes

| Index | Migration | Purpose |
|-------|-----------|---------|
| `idx_app_id_user` | 005 | `(id, user_id)` ownership |
| `idx_app_jobs_application` | 011b | Latest jobs by app |
| `idx_app_jobs_app_type_created` | **013** | Status poll: latest per `job_type` |

## Before / after (expected)

| Metric | Before | After (target) |
|--------|--------|----------------|
| DB round-trips per `/status` | 3 | 1 |
| Unchanged poll (304) | Full serialize + 200 JSON | Fingerprint + 304 |
| Local p95 | 250ms–2000ms spikes | &lt;100–150ms |
| `bundleQueryMs` p95 | N/A | &lt;50ms local |

Fill measured values from server logs after soak test:

```
# Example log filter
# STATUS_POLL | STATUS_POLL_SLOW | STATUS_POLL_SLOW_DB | STATUS_POLL_CRITICAL | STATUS_POLL_NOT_MODIFIED
```

## Pool metrics

- `POOL_METRICS` logged every 60s in development when `poolWaiting > 0` or `poolIdle === 0`
- `DB_POOL_PRESSURE` on each instrumented status query when pool is saturated
- Script: `node scripts/checkDbContention.js`

If `poolWaiting` correlates with `STATUS_POLL_SLOW_DB`, consider raising `max` in `src/db.js` only after query consolidation (e.g. 10 → 15).

## Lock / contention findings

Status reads use default **READ COMMITTED** without `FOR UPDATE`. Recovery/worker writes may cause brief row versions but should not block SELECT.

Run `checkDbContention.js` during recovery loop; document any `blocked_pid` rows here:

- _Run locally and paste results if blocking observed._

## Client

- Poll hook sends `If-None-Match` from per-app etag cache
- `304` treated as success (no state patch, no error counter)

## Stable latency profile (acceptance)

- [ ] Local p95 `/status` &lt; 150ms (200 responses)
- [ ] `304` responses &lt; 20ms server time when state unchanged
- [ ] No sustained `STATUS_POLL_CRITICAL` (&gt;500ms) under 5 pollable apps
- [ ] `DB_QUERY_SLOW` rare on `status_bundle` after index 013 applied
