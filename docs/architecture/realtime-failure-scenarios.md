# Realtime failure scenarios (operational)

| Scenario | Detection | Recovery | User-visible |
|----------|-----------|----------|--------------|
| SSE disconnect (< 60s) | Transport degraded/disconnected | Tier 1: `Last-Event-ID` replay | Status resumes without full reload |
| Browser sleep/wake | Zombie reap may close stale socket | Reconnect + Tier 1–2 | Brief gap; no poll loop |
| Duplicate leader | Tab leader election | One SSE; follower mirrors | No duplicate streams |
| Tab crash | Leader lost | Other tab claims leader; Tier 3 if no cursor | May need refresh if long gap |
| Redis outage | Replay unavailable | Tier 2/3; local bus if single node | Degraded banner if Tier 3 exhausted |
| Replay expired (> 30m) | `X-Replay-Status: expired` | Tier 3 bootstrap | One list refresh |
| Stale cache row | Watchdog | Tier 2 per-row status fetch | Row updates |
| Tier-2 bound (> 50 apps) | `TIER2_BOUND_EXCEEDED` | Tier 3 | Single hydrate |
| Tier-3 storm | 3 failures / 5m | `REALTIME_DEGRADED_MODE` | Manual refresh copy |

Correctness guarantee: UI reflects highest known `version` per application after recovery completes.
