# Runbook: AI failures

## Symptoms

- Application `failed` at draft/generation stage
- `JOB_FAILED` with LLM error in logs

## Debug

1. `llm_usage_logs` for `error_code`
2. User credential health in DB
3. `DEBUG=llm` trace
4. Circuit breaker state (cooldown 30s)

## Fix

| Error class | Action |
|-------------|--------|
| invalid_api_key | User re-saves credential |
| rate_limited | Wait; rotate chain |
| timeout | Retry; check input size |
| circuit open | Wait cooldown; reduce traffic |

## Related Documentation

- [../../ai/timeouts-and-protection.md](../../ai/timeouts-and-protection.md)
