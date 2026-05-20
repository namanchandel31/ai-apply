# Runtime expectations

Code-grounded normal vs warning vs critical thresholds.

## Queue / workers

| Metric | Normal | Warning | Critical |
|--------|--------|---------|----------|
| Job wait time | < 30s | 30s–5m | > 5m sustained |
| Failed queue depth | 0–few | growing | unbounded growth |
| Stalled jobs | 0 | occasional `JOB_STALLED` | repeated stalls same queue |

Process attempts: 3. Send attempts: 5. Backoff base 2s exponential.

## Polling (client)

| Constant | Value |
|----------|-------|
| Active poll | 3s |
| SSE fallback poll | 30s |
| Max poll window | 180s |
| Max consecutive errors | 3 |

## SSE

| Constant | Value |
|----------|-------|
| Heartbeat | 25s |
| Reconnect | client backoff via `reconnectLogPolicy` |

## AI

| Operation | Timeout |
|-----------|---------|
| Generation | 45s |
| Email gen | 10s |
| Health check | 20s |
| Circuit cooldown | 30s after 10 failures |

## DB

Pool: max 10 connections, 10s connection timeout — see `db.js`.

## Status poll API

Target p95 < 200ms warm (see legacy status-latency-report); **304** on ETag hit expected under steady state.

## Related Documentation

- [../frontend/status-and-polling.md](../frontend/status-and-polling.md)
- [../troubleshooting/common-issues.md](../troubleshooting/common-issues.md)
