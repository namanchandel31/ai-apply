# Metrics and debug scopes

## Debug scopes (frozen)

| Scope | Env | Covers |
|-------|-----|--------|
| orchestration | `DEBUG` / `VITE_DEBUG` | SSE, reconciliation, hydration, leader |
| query | `DEBUG=query` | SQL shape, pool metrics |
| llm | `DEBUG=llm` | Gateway verbose |

Unknown tokens ignored with one-time warning.

## Metrics

[`orchestrationMetrics.js`](../../src/observability/orchestrationMetrics.js) — `increment`, `histogram`, `gauge` (vendor-agnostic).

Examples: `orchestration.reconcile.reject`, `orchestration.reconnect.attempt`.

## Related Documentation

- [runtime-expectations.md](runtime-expectations.md)
