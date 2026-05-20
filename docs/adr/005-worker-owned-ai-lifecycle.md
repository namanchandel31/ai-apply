# ADR-005: Worker-owned AI lifecycle

**Status:** accepted

## Context

Resume/JD parsing and email generation use LLMs with variable latency, rate limits, and provider failover.

## Problem

HTTP-owned AI breaks timeout budgets, bypasses `llmProtection` circuit breaker, and cannot retry safely across process restarts.

## Decision

All production AI execution runs in workers (via `aiGateway` / `jobHandler`), invoked from `processApplication.worker`.

Platform defaults: `openai` + `gpt-4.1-mini` in [`ai.config.js`](../../src/config/ai.config.js) — not env-driven.

## Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| Sync parse on upload | Upload timeout |
| Client-side LLM | Secret exposure |
| Server-sent streaming to browser | Complexity; not required for MVP |

## Tradeoffs

| Pro | Con |
|-----|-----|
| Retry + circuit breaker centralized | Worker capacity planning required |
| Credential chain per user | Cold start on first job |

## Operational implications

- Monitor `llm_usage_logs` and circuit breaker metrics.
- Scale process worker replicas for AI load.

## Future considerations

- Dedicated `ai` queue with higher concurrency.
- Async batch parsing pipeline.

## Related Documentation

- [../ai/README.md](../ai/README.md)
- [../workers/process-worker.md](../workers/process-worker.md)
