# Anti-patterns

Forbidden patterns that erode the architecture. Each entry: danger → ops risk → scaling impact → correct pattern.

## AI calls inside controllers

| | |
|-|-|
| **Danger** | HTTP thread blocked for 10–45s+ |
| **Ops risk** | Timeouts, 502s, pool exhaustion |
| **Scaling** | API replicas cannot scale independently |
| **Instead** | Enqueue `ai_process`; worker calls `aiGateway` |

## Direct DB updates bypassing CAS

| | |
|-|-|
| **Danger** | Race: double send, invalid transitions |
| **Ops risk** | Duplicate SMTP, angry users |
| **Scaling** | Hard-to-debug intermittent bugs |
| **Instead** | `transitionApplicationState`, `markSentFromGenerated` |

## Using events as source of truth

| | |
|-|-|
| **Danger** | Replay/order bugs drive automation |
| **Ops risk** | Wrong worker decisions |
| **Scaling** | Full table scans for “current” state |
| **Instead** | `applications` + latest `application_jobs` |

## Deriving UI only from DB business enum

| | |
|-|-|
| **Danger** | Misses active job states (processing, sending) |
| **Ops risk** | UI shows idle while worker running |
| **Scaling** | Frontend hacks with string compares |
| **Instead** | API `uiStatus` + `pollable` from resolver |

## Non-deterministic job IDs

| | |
|-|-|
| **Danger** | Duplicate BullMQ jobs |
| **Ops risk** | Double LLM/SMTP spend |
| **Scaling** | Queue depth explosion on retry storms |
| **Instead** | `process:application:{id}`, `send:application:{id}` |

## Silent CAS failures

| | |
|-|-|
| **Danger** | Thinks transition succeeded |
| **Ops risk** | Stuck or duplicate terminal states |
| **Scaling** | Data repair migrations |
| **Instead** | Propagate CAS miss; log and fail job |

## Retry swallowing

| | |
|-|-|
| **Danger** | Job marked completed with partial failure |
| **Ops risk** | Silent data loss |
| **Scaling** | Unbounded bad state |
| **Instead** | Classify error; BullMQ retry or `UnrecoverableError` |

## Mixed business/execution state on one column

| | |
|-|-|
| **Danger** | Reintroduces pre-011b bugs |
| **Ops risk** | Retry semantics break |
| **Scaling** | Cannot shard by concern |
| **Instead** | Four-layer truth model |

## Queue side effects in request lifecycle

| | |
|-|-|
| **Danger** | Enqueue without durable DB row |
| **Ops risk** | Orphan jobs |
| **Scaling** | Recovery job load spikes |
| **Instead** | Transaction: job row + enqueue |

## Giant uiStatus god resolver

| | |
|-|-|
| **Danger** | Un-testable branching |
| **Ops risk** | Wrong capabilities shipped |
| **Scaling** | Every feature touches one file |
| **Instead** | Pipeline: `buildResolverContext` → `resolveUiStatus` → `resolveCapabilities` |

## Related Documentation

- [../architecture/system-invariants.md](../architecture/system-invariants.md)
- [../architecture/ownership-boundaries.md](../architecture/ownership-boundaries.md)
- [conventions.md](conventions.md)
