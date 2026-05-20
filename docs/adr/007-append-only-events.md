# ADR-007: Append-only application events

**Status:** accepted

## Context

Operators need retry lineage; product may add analytics. Mutable history erodes trust.

## Problem

Updating or deleting event rows makes incident response and compliance reconstruction impossible.

## Decision

`application_events` is **insert-only**. Current automation state lives in `applications` + `application_jobs`, not events.

## Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| Events as sole source of truth | Replay complexity |
| Upsert events by type | Loses attempt history |
| No events | Weak audit story |

## Tradeoffs

| Pro | Con |
|-----|-----|
| Clear audit trail | Table growth over time |
| Safe concurrency | Storage/archival planning needed |

## Operational implications

- Index `(application_id, created_at)` for timeline queries.
- Future archival/partitioning by `created_at` (see roadmap).

## Future considerations

- Event streaming to warehouse (CDC / outbox).
- Compaction jobs for old events (copy to cold storage, not UPDATE).

## Related Documentation

- [../database/schema.md](../database/schema.md)
- [../architecture/state-model.md](../architecture/state-model.md)
