# Future architecture

**Current** vs **future** — do not implement from this doc without new ADRs.

## What breaks first (scaling order)

| Bottleneck | Signal | Likely evolution |
|------------|--------|------------------|
| `application_events` table size | Slow timeline queries | Partition/archive by month |
| uiStatus resolver complexity | Frequent resolver bugs | Split rules by domain; test matrix |
| Single Redis | CPU/memory ceiling | Dedicated Redis per queue tier |
| Colocated workers | AI blocks send | Isolate `ai` and `send` worker pools |
| Poll + SSE dual path | Client CPU on large lists | SSE-only with adaptive subscribe |
| Synchronous status bundle | DB load on poll | Read replica or materialized view |

## Current architecture (summary)

Monolith API + separate workers + Postgres truth layers + Redis queues + optional Redis realtime fan-out.

## Future directions

### Realtime

- WebSocket for bidirectional features (optional)
- Adaptive polling: poll interval from server hint
- Server-driven `pollable` set via SSE only

### Queues

- Priority queues for paid tier
- Queue partitioning by `userId` hash
- Outbox pattern for exactly-once side effects

### AI

- ATS scoring, ranking, enrichment pipelines
- Dedicated async AI queue with higher concurrency
- Semantic caching of parsed JDs

### Data

- Event streaming to warehouse (CDC)
- Analytics pipeline separate from OLTP
- Multi-region read replicas (Postgres)

### Platform

- Multi-region active-active (hard — requires CRDT or single-writer regions)
- JWT revocation / session store

## Related Documentation

- [../queues/scaling.md](../queues/scaling.md)
- [../adr/README.md](../adr/README.md)
