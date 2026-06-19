# Render deployment (single service)

One Web Service runs the API and BullMQ workers together via `src/bootstrap.js`.

## Render settings

| Setting | Value |
|---------|--------|
| Root Directory | *(repo root)* |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Health Check Path | `/health` |

## Required environment variables

```env
NODE_ENV=production
PORT=10000
WORKER_MODE=combined
DATABASE_URL=
REDIS_URL=
# or UPSTASH_REDIS_URL=rediss://...
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
INTERNAL_API_KEY=
ENCRYPTION_KEY=
OPENAI_API_KEY=
```

Optional: `SENTRY_DSN`, `LOG_LEVEL`.

`CORS_ORIGIN` must include your Vercel app URL(s), comma-separated. See [vercel-render-auth.md](./vercel-render-auth.md).

## Frontend (Vercel)

Set `VITE_API_URL` to your Render service URL (e.g. `https://ai-apply-api.onrender.com`).

## Future split

| Service | Start command |
|---------|----------------|
| API only | `npm run start:api` |
| Workers only | `npm run worker` |
| Combined (current) | `npm start` |

No code changes required — only the start command and `WORKER_MODE`.


## Scaling / split services

When traffic grows, split without code changes:

| Service | Start command | `WORKER_MODE` |
|---------|---------------|-----------------|
| API | `npm run start:api` | `separate` |
| Worker | `npm run worker` | `separate` |

Suspend the combined service after split is verified. Keep worker service config when moving to combined (suspend, do not delete).

## Redis optimization

See [../ops/redis-optimization-baseline.md](../ops/redis-optimization-baseline.md) and [../ops/redis-optimization-comparison.md](../ops/redis-optimization-comparison.md).
