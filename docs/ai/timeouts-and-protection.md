# Timeouts and protection

**Source:** [`ai.config.js`](../../src/config/ai.config.js), [`llmProtection.js`](../../src/services/llmProtection.js).

## Timeouts

| Constant | MS |
|----------|-----|
| RUNTIME_GENERATION_TIMEOUT_MS | 45000 |
| RUNTIME_EMAIL_TIMEOUT_MS | 10000 |
| HEALTH_CHECK_TIMEOUT_MS | 20000 |

## Circuit breaker

| Constant | Value |
|----------|-------|
| LLM_CIRCUIT_BREAKER_THRESHOLD | 10 failures |
| LLM_CIRCUIT_BREAKER_COOLDOWN_MS | 30000 |
| LLM_GLOBAL_RETRY_BUDGET | 100 / window |

## Retry policy

[`aiRetryPolicy.js`](../../src/services/aiRetryPolicy.js) classifies provider errors for credential rotation.

## Related Documentation

- [../observability/runtime-expectations.md](../observability/runtime-expectations.md)
- [../troubleshooting/runbooks/ai-failures.md](../troubleshooting/runbooks/ai-failures.md)
