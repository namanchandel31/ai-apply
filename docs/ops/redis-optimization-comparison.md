# Redis optimization — comparison report

Complete **after** deploy and E2E verification. **Conclusions must use measured data only.**

## Post-change — YYYY-MM-DD

| Metric | Before (baseline) | After | Change % |
|--------|-------------------|-------|----------|
| Data window | | | |
| Upstash commands/day | | | |
| Upstash commands/sec avg | | | |
| Render CPU peak | | | |
| Render memory peak | | |
| Process latency (sample) | | | |
| Send latency (sample) | | | |
| Queue depth after backlog test | | | |

## Hypotheses vs measurements

| Change | Estimated impact (hypothesis) | Measured impact | Notes |
|--------|------------------------------|-----------------|-------|
| Disable prod diagnostics | Moderate | | |
| Concurrency 1/1 | Moderate idle reduction | | |
| Combined single service | Large if 2nd process removed | | |

## E2E verification

| Flow | Pass? | Notes |
|------|-------|-------|
| Single application (process) | | |
| Email send | | |
| Recovery loop (logs) | | |
| Retry behavior | | |
| Backlog test (10–20 apps) | | |
| `/health` | | |
| No `RUNTIME_DIAGNOSTICS` in prod logs | | |

## Conclusions (measured only)

- Redis usage decreased measurably: _yes / no_
- Largest measured contributor: _
- Remaining baseline (commands/month): _
- Free tier viable: _yes / no_
- Further optimization: _defer until this report is reviewed_

## Rollback reference

Split services without code revert:

```txt
API:     WORKER_MODE=separate  Start: npm run start:api
Worker:  WORKER_MODE=separate  Start: npm run worker
```
