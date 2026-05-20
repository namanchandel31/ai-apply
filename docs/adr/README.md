# Architecture Decision Records (ADR)

Permanent log of significant engineering decisions.

## Status lifecycle

| Status | Meaning |
|--------|---------|
| `proposed` | Under discussion, not yet shipped |
| `accepted` | Shipped and current |
| `deprecated` | No longer recommended; still documented |
| `superseded` | Replaced by another ADR — must link `Superseded-by` |

Do not delete ADRs. Update status and link forward.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [001](001-three-truths-model.md) | Three-truths state model | accepted |
| [002](002-deterministic-job-ids.md) | Deterministic BullMQ job IDs | accepted |
| [003](003-cas-state-transitions.md) | CAS state transitions | accepted |
| [004](004-thin-controller-architecture.md) | Thin controller architecture | accepted |
| [005](005-worker-owned-ai-lifecycle.md) | Worker-owned AI lifecycle | accepted |
| [006](006-sse-over-pure-websocket.md) | SSE over pure WebSocket | accepted |
| [007](007-append-only-events.md) | Append-only events | accepted |

## Template for new ADRs

```md
# ADR-NNN: Title

**Status:** proposed | accepted | deprecated | superseded
**Superseded-by:** ADR-XXX (if applicable)
**Replaces:** ADR-YYY (if applicable)

## Context
## Problem
## Decision
## Alternatives considered
## Tradeoffs
## Operational implications
## Future considerations
```

## Related Documentation

- [../development/documentation-governance.md](../development/documentation-governance.md)
- [../architecture/source-of-truth-hierarchy.md](../architecture/source-of-truth-hierarchy.md)
