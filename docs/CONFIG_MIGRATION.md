# Configuration migration

## Removed variables

| Removed | Replacement |
|---------|-------------|
| `WORKER_MODE` | Dev: inline workers when `NODE_ENV !== production`. Prod: `npm run worker` |
| `WORKER_CONCURRENCY`, `PROCESS_WORKER_CONCURRENCY` | Code constants in `queue.config.js` |
| `DEBUG_ORCHESTRATION_*` (×6) | `DEBUG=orchestration` |
| `VITE_DEBUG_ORCHESTRATION_*` (×6) | `VITE_DEBUG=orchestration` |
| `DEBUG_QUERY_SHAPE`, `LOG_QUERY_SHAPE` | `DEBUG=query` |
| `DEBUG_RESUME_EXTRACTION_ONLY`, `DEBUG_LLM_TIMINGS` | `DEBUG=llm` |
| `LOG_DEDUPE_*` | Constants in `logging.config.js` |
| `REALTIME_REDIS`, `REALTIME_REDIS_CHANNEL` | Redis on when `REDIS_URL` set; fixed channel |
| `LLM_*` circuit/retry envs | `ai.config.js` constants |
| `DEFAULT_AI_PROVIDER`, `DEFAULT_AI_MODEL`, `AI_PLATFORM_FALLBACK_PROVIDERS` | `ai.config.js` constants |
| `PARSE_LLM_*`, `HEALTH_CHECK_*`, `LLM_TIMEOUT_MS`, etc. | `ai.config.js` constants |
| `STRICT_QUEUE_VALIDATION` | Strict when `NODE_ENV=production` |
| `DB_PASSWORD` | Use `DATABASE_URL` only |
| `SUPABASE_ANON_KEY` | Unused |
| `SMTP_*` | Gmail in `mail.config.js` |
| Duplicate `REDIS_URL` | Single entry |

## Breaking deploy checklist

1. Remove deleted keys from `.env` / secrets manager
2. Add `DEBUG` / `VITE_DEBUG` only if deep dev logging needed
3. Ensure production runs workers separately (no `WORKER_MODE=inline`)
4. Run `npm test` after updating CI env templates
