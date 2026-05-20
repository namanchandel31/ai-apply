# Examples library

Real shapes from the codebase — **not** hand-invented JSON.

## Sourcing rules (anti-drift)

Examples **must** be traceable to:

| Source | Use for |
|--------|---------|
| [`applicationSerializer.js`](../../src/services/applicationSerializer.js) | API application + status payloads |
| [`sseFormat.js`](../../src/realtime/sseFormat.js) | SSE frame structure |
| Queue modules / workers | BullMQ `jobId` and `job.data` |
| Tests (`tests/orchestration/`, etc.) | Edge cases |
| [`logger.js`](../../src/utils/logger.js) | Log `event` names |

**Forbidden:** illustrative payloads without a source file citation.

## Maintenance

When serializers or API contracts change, update examples in the **same PR** — see [../development/documentation-governance.md](../development/documentation-governance.md).

## Index

| Doc | Content |
|-----|---------|
| [request-payloads.md](request-payloads.md) | HTTP bodies |
| [queue-jobs.md](queue-jobs.md) | BullMQ IDs and data |
| [sse-events.md](sse-events.md) | SSE frames |
| [retry-flows.md](retry-flows.md) | Retry sequences |
| [cas-failure-examples.md](cas-failure-examples.md) | CAS miss scenarios |
| [application-state-examples.md](application-state-examples.md) | Serialized status |
| [worker-logs.md](worker-logs.md) | Structured log events |
| [recovery-scenarios.md](recovery-scenarios.md) | Recovery job behavior |

## Related Documentation

- [../architecture/source-of-truth-hierarchy.md](../architecture/source-of-truth-hierarchy.md)
- [../api/README.md](../api/README.md)
