# Common issues

Format: **Symptom → Root cause → Debug → Fix**

## Redis connection refused

| | |
|-|-|
| **Symptom** | ECONNREFUSED :6379, queue errors in logs |
| **Cause** | Redis not running or wrong `REDIS_URL` |
| **Debug** | `redis-cli ping` |
| **Fix** | Start Redis; fix env |

## Stuck in processing

| | |
|-|-|
| **Symptom** | `uiStatus: processing` for > 5 min |
| **Cause** | Worker down, LLM hang, job stalled |
| **Debug** | queue-health, worker logs, `application_jobs` row |
| **Fix** | Restart worker; recovery job; user retry |

## Duplicate send fear

| | |
|-|-|
| **Symptom** | Two emails received |
| **Cause** | Manual DB edit or bypass CAS (rare if invariants hold) |
| **Debug** | `application_events`, completed send jobs |
| **Fix** | Fix process; prevent non-CAS updates |

## Poll not updating UI

| | |
|-|-|
| **Symptom** | Table frozen |
| **Cause** | SSE down + poll stopped early; ignoring `pollable` |
| **Debug** | Network tab SSE; `pollable` in status API |
| **Fix** | Reconnect; use capabilities from API |

## AI always failing

| | |
|-|-|
| **Symptom** | `failed` after draft |
| **Cause** | Invalid key, rate limit, circuit open |
| **Debug** | `DEBUG=llm`, `llm_usage_logs`, credential health |
| **Fix** | Update credentials; wait cooldown |

## Migration failed

| | |
|-|-|
| **Symptom** | `npm run migrate` error |
| **Cause** | Drifted manual schema |
| **Debug** | Compare `schema_migrations` table |
| **Fix** | Align DB or baseline script |

## Related Documentation

- [runbooks/](runbooks/)
