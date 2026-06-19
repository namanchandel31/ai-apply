# Redis optimization — baseline snapshot

Captured **before** approved changes (diagnostics off, concurrency 1/1, combined deploy).

Fill from Upstash + Render dashboards. Do not wait for a full 24h window — use the longest window currently available.

## Baseline — 2026-06-19

| Metric | Value | Source / window |
|--------|-------|-----------------|
| Data window | _e.g. Upstash month-to-date, Render last 24h_ | |
| Render topology | _combined \| split: API + worker_ | Render dashboard |
| Start command (API) | | |
| Start command (worker) | | |
| `WORKER_MODE` | | |
| Upstash commands (period total) | _e.g. ~296k / 500k monthly quota observed pre-change_ | Upstash Usage |
| Upstash commands/day (est.) | | Upstash Monitor |
| Upstash commands/sec avg | | Upstash Monitor |
| Upstash commands/sec peak | | Upstash Monitor |
| Render CPU avg / peak | | Render Metrics |
| Render memory avg / peak (MB) | | Render Metrics |
| Queue waiting (process) | | `/internal/queue-health` |
| Queue waiting (send) | | `/internal/queue-health` |
| Process latency (sample, s) | | Test apply timestamps |
| Send latency (sample, s) | | Test send timestamps |

## Notes

- Pre-change hypothesis: largest Redis consumers are BullMQ idle polling + 30s runtime diagnostics.
- Runtime diagnostics: `RUNTIME_DIAGNOSTICS` log every 30s in non-production only after change 1.

## Approved changes (this initiative)

1. Disable `startRuntimeDiagnostics` in production
2. `WORKER_CONCURRENCY`: process 1, send 1
3. Combined Render default (`npm start`, `WORKER_MODE=combined`)
