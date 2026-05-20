# System invariants

Immutable truths that must **always** hold. Stronger than conventions; violations are bugs.

> **Rule:** If code breaks an invariant, fix the code—not the invariant—unless an ADR supersedes it.

## Invariant list

| ID | Invariant | Enforced by |
|----|-----------|-------------|
| I1 | `uiStatus` is never persisted | `serializeApplication`, no DB column |
| I2 | `application_events` are append-only | No UPDATE on events; INSERT only |
| I3 | Workers do not write presentation fields directly | No `uiStatus` in worker SQL |
| I4 | CAS failures are never ignored | `transitionApplicationState`, `markSentFromGenerated` throw or return explicit failure |
| I5 | HTTP requests never own AI or SMTP lifecycle | AI/SMTP only in workers/services called from workers |
| I6 | HTTP requests never own BullMQ retry loops | Retries = BullMQ + worker logic |
| I7 | Each `application_jobs` row belongs to exactly one application | FK `application_id` |
| I8 | Deterministic BullMQ IDs for app-scoped work | `process:application:{id}`, `send:application:{id}` |
| I9 | `application_status` and job `status` are not interchangeable | Separate enums and resolvers |
| I10 | Only `transitionApplicationState` bumps orchestration version/epoch (with defined exceptions) | `orchestrationVersion.js` |
| I11 | Send path uses CAS `generated` → `sent` | `markSentFromGenerated` |
| I12 | Completed send job blocks duplicate SMTP | `hasCompletedSendJob` |

## Operational implications

| Invariant | If violated |
|-----------|-------------|
| I1 | UI drift across tabs; DB migrations to “fix” UI |
| I2 | Audit trail loss; compliance/debug failure |
| I4 | Double send, duplicate charges, inconsistent state |
| I5 | Timeouts, connection pool exhaustion, unbounded HTTP latency |
| I8 | Duplicate workers processing same application |

## Concurrency

- CAS transitions prevent two send workers both marking `sent`.
- Deterministic job IDs prevent duplicate active BullMQ jobs for same application phase.
- Orchestration version rejects stale SSE events on the client.

## Related Documentation

- [state-model.md](state-model.md)
- [ownership-boundaries.md](ownership-boundaries.md)
- [../development/anti-patterns.md](../development/anti-patterns.md)
- [../adr/003-cas-state-transitions.md](../adr/003-cas-state-transitions.md)
