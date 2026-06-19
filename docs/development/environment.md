# Environment variables

All application config loads through [`src/config/`](../../src/config/). Do not read `process.env` elsewhere (except `tests/setup.js` and one-off scripts).

## Required (production)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | BullMQ + realtime pub/sub |
| `SUPABASE_URL` | JWKS + storage (required) |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Frontend Google OAuth (client `.env`) |
| `INTERNAL_API_KEY` | `/internal/*` routes |
| `ENCRYPTION_KEY` | 32-byte hex for credential encryption |
| `SUPABASE_URL` | Storage API |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side uploads |

Generate encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Optional

| Variable | Default | Purpose |
|----------|---------|---------|
| `NODE_ENV` | `development` | Environment |
| `PORT` | `5000` | HTTP port |
| `OPENAI_API_KEY` | — | Platform AI fallback |
| `LOG_LEVEL` | `info` | Pino level |
| `LOG_PRETTY` | `true` in dev | Pretty logs |
| `DEBUG` | (empty) | `orchestration`, `query`, `llm` only |
| `AUTO_APPLY_HOURLY_LIMIT` | `10` | Rate limit |
| `AUTO_APPLY_DAILY_LIMIT` | `50` | Rate limit |

## Client (Vite)

Copy to `client/.env`:

| Variable | Purpose |
|----------|---------|
| `VITE_DEBUG` | Same 3-scope allowlist as `DEBUG` |

## Code constants (not env)

| Constant | Location |
|----------|----------|
| Worker concurrency (process: 1, send: 1) | `queue.config.js` |
| Job max attempts | `queue.config.js` |
| LLM timeouts, circuit breaker | `ai.config.js` |
| Platform AI provider/model | `ai.config.js` (`openai`, `gpt-4.1-mini`) |
| Gmail SMTP | `mail.config.js` |
| SSE heartbeat 25s | `realtime.config.js` |

## Worker bootstrap

No `WORKER_MODE`. Development API auto-starts inline workers when `NODE_ENV !== production`.

## Removed variables

See [CONFIG_MIGRATION.md](../CONFIG_MIGRATION.md) for migration from legacy env flags.

## Related Documentation

- [local-setup.md](local-setup.md)
- [../architecture/async-processing.md](../architecture/async-processing.md)
- [documentation-governance.md](documentation-governance.md)
