# PostgreSQL connection resilience

## Retry policy

| Execution path | Implicit retry |
|----------------|----------------|
| `pool.query(...)` (wrapped pool) | Yes — up to 3 attempts with backoff + circuit breaker |
| `instrumentedQuery(pool, ...)` | Yes |
| `client.query(...)` inside `BEGIN` / `COMMIT` | **No** |
| `instrumentedQuery(client, ...)` (checked-out client) | **No** |
| `withPgTransaction` / `withPgClient` callbacks | **No** for in-txn statements |

Connection loss mid-transaction makes transaction state ambiguous. Do not retry individual statements inside a transaction.

Future transactional retry (not implemented): restart the **entire** transaction only for explicitly idempotent flows.

## Circuit breaker

Process-local in-memory breaker on the retry path:

- Opens after 10 transient failures in 30s
- Cooldown: `PG_RETRY_CIRCUIT_COOLDOWN_MS` (default 20s)
- While open: fast-fail transient errors (no retry amplification)

## Process lifecycle

**Recoverable (contain, no exit):** `ECONNRESET`, `ETIMEDOUT`, transient PG disconnect messages, socket interruptions.

**Fatal (exit):** `TypeError`, `ReferenceError`, bootstrap/migration corruption, unclassified non-infra errors.

## Client error listeners

`attachPgClientErrorHandler` uses `client.__pgErrorHandlerAttached` to prevent duplicate listeners on pooled client reuse.
