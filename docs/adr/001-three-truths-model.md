# ADR-001: Three-truths state model (plus derived uiStatus)

**Status:** accepted

## Context

Job application automation spans user-visible progress, workflow outcomes, worker execution, and audit history. A single `status` column caused retry bugs and UI drift.

## Problem

- Retries overwrote execution history.
- UI could not express “failed attempt but retryable workflow.”
- Operations could not reconstruct what happened.

## Decision

Split state into:

```txt
applications       = business truth
application_jobs   = execution truth
application_events = audit truth
uiStatus           = derived truth (never persisted)
```

## Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| Single `status` column | Conflates attempt vs workflow |
| Event sourcing for current state | Operational complexity; events remain audit-only |
| Persist `uiStatus` | Drift from jobs/business on race |

## Tradeoffs

| Pro | Con |
|-----|-----|
| Clear ownership | More joins on read |
| Safe retries | Resolver must stay in sync with rules |

## Operational implications

- Status API must query application + latest jobs.
- Metrics should tag business vs job failures separately.
- Migrations must not collapse layers again.

## Future considerations

- Materialized read models for analytics (without replacing truth layers).
- Outbox for cross-service events if split into microservices.

## Related Documentation

- [../architecture/state-model.md](../architecture/state-model.md)
- [../architecture/system-invariants.md](../architecture/system-invariants.md)
