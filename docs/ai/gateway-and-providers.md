# AI gateway and providers

Central orchestration in [`aiGateway.js`](../../src/services/aiGateway.js).

## Flow

1. Resolve credential chain (`aiCredentialService`)
2. Apply `llmProtection` (budget, circuit breaker)
3. Call provider client with timeout from `ai.config`
4. Log usage to `llm_usage_logs`

## Endpoints (internal)

| Endpoint key | Timeout |
|--------------|---------|
| `resume_parse`, `jd_parse` | 45000 ms |
| `email_generate` | 10000 ms |
| `health_check` | 20000 ms |

## Deprecated

`llmClient.js` — re-exports gateway; do not use in new code.

## Related Documentation

- [byok-and-fallback.md](byok-and-fallback.md)
- [timeouts-and-protection.md](timeouts-and-protection.md)
