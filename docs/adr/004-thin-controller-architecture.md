# ADR-004: Thin controller architecture

**Status:** accepted

## Context

HTTP handlers are tempting place for “just one LLM call” shortcuts.

## Problem

Long work on request thread causes timeouts, poor retry classification, and connection pool starvation under load.

## Decision

Controllers: **validate → persist (minimal) → enqueue → respond**.

Workers and domain services own long-running and retryable work.

## Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| Sync auto-apply for simpler UX | Timeouts at scale |
| Background `setImmediate` in controller | No durability on crash |
| Separate microservice immediately | Ops cost premature |

## Tradeoffs

| Pro | Con |
|-----|-----|
| Predictable latency | More moving parts (Redis, workers) |
| Clear failure domains | 202 + poll/SSE required |

## Operational implications

- API horizontal scaling does not require GPU/LLM capacity.
- Worker scaling is independent of API replicas.

## Future considerations

- Webhook callbacks instead of poll for external integrators.

## Related Documentation

- [../architecture/ownership-boundaries.md](../architecture/ownership-boundaries.md)
- [../backend/controllers.md](../backend/controllers.md)
