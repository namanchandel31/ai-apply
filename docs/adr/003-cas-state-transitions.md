# ADR-003: CAS state transitions

**Status:** accepted

## Context

Multiple workers, retries, and user actions can race to update the same application (e.g. two send workers after generation).

## Problem

Last-write-wins `UPDATE` allows double send, invalid status jumps, and lost orchestration version monotonicity.

## Decision

- Business transitions via `transitionApplicationState()` with expected prior status.
- Send completion via `markSentFromGenerated()` (CAS `generated` → `sent`).
- CAS failures are explicit errors — never ignored.

## Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| Row locks for all updates | Deadlock risk; holds connections |
| Optimistic UI only | Server still races |
| Event-only state | Events are audit, not current truth |

## Tradeoffs

| Pro | Con |
|-----|-----|
| Safety under concurrency | Callers must handle CAS miss |
| Clear failure modes | More code paths |

## Operational implications

- Alerts on repeated CAS failure may indicate duplicate workers or bad redeploy.
- Playbooks: check `hasCompletedSendJob` before manual retry.

## Future considerations

- Serializable isolation for command endpoints if contention grows.

## Related Documentation

- [../backend/transactions-and-cas.md](../backend/transactions-and-cas.md)
- [../examples/cas-failure-examples.md](../examples/cas-failure-examples.md)
