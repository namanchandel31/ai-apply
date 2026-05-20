# Retry and backoff

**Source:** `queue.config.js`, queue `defaultJobOptions`.

## Max attempts

| Queue | Attempts |
|-------|----------|
| process-application | 3 |
| send-application | 5 |

## Backoff

Exponential, base delay **2000 ms** (per queue module).

## Unrecoverable errors

Workers throw `UnrecoverableError` (BullMQ) for:

- Missing credentials
- Validation failures
- CAS already terminal

## LLM retries

Separate from BullMQ — `llmProtection` + `aiRetryPolicy` inside process worker.

## Related Documentation

- [../ai/timeouts-and-protection.md](../ai/timeouts-and-protection.md)
- [../examples/retry-flows.md](../examples/retry-flows.md)
