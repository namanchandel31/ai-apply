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

## Frontend (Vercel)

Set `VITE_API_URL` to your Render service URL (e.g. `https://ai-apply-api.onrender.com`).

## Future split

| Service | Start command |
|---------|----------------|
| API only | `npm run start:api` |
| Workers only | `npm run worker` |
| Combined (current) | `npm start` |

No code changes required — only the start command and `WORKER_MODE`.
