# Operational playbooks

High-level on-call flows. Detail in runbooks.

## Application stuck processing

1. `GET /api/applications/:id/status` — check `uiStatus` + jobs
2. `queue-health` — depth and failed
3. Worker logs — `JOB_FAILED` reason
4. Run recovery or manual retry — [runbook](../troubleshooting/runbooks/stuck-jobs.md)

## Duplicate send suspicion

1. Check `hasCompletedSendJob`
2. Check CAS logs / `application_events`
3. Do not manual `UPDATE` to `sent` — use retry flow

## LLM outage

1. Circuit breaker open — wait cooldown 30s
2. Check `llm_usage_logs` and credential health
3. [ai-failures runbook](../troubleshooting/runbooks/ai-failures.md)

## Redis down

API enqueue fails; SSE fan-out breaks multi-instance. [redis-down runbook](../troubleshooting/runbooks/redis-down.md).

## Related Documentation

- [runtime-expectations.md](runtime-expectations.md)
