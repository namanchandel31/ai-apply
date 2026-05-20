# Local setup

Run the full stack on a developer machine.

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ (22 LTS recommended) |
| PostgreSQL | 14+ or Supabase Postgres |
| Redis | 6+ (local or Docker) |
| OpenAI API key | Platform fallback |
| Supabase project | `resumes` storage bucket |
| Gmail | 16-char [app password](https://support.google.com/accounts/answer/185833) |

## Install

```bash
git clone <repo>
cd ai-apply
npm install
cp .env.example .env
```

Configure `.env` — see [environment.md](environment.md).

```bash
npm run migrate
cd client && npm install && cd ..
npm run build:ui
```

## Run

| Command | What starts |
|---------|-------------|
| `npm run dev` | API on `PORT` (default 5000) + **inline workers** in development |
| `npm run worker` | Workers only (production-like) |
| `npm run dev:client` | Vite dev server (optional; prod UI served from `public/`) |

**Production-like split:**

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run worker
```

Set `NODE_ENV=production` in API to disable inline workers.

## Ports

| Service | Default |
|---------|---------|
| API + static UI | 5000 |
| Vite dev | 5173 (if using `dev:client`) |
| PostgreSQL | 5432 |
| Redis | 6379 |

## Supabase

Create bucket `resumes`. Uploads path: `{userId}/{fileHash}.pdf`.

## Verify

```bash
curl http://localhost:5000/health
npm test
```

Open `http://localhost:5000` — signup, setup, auto-apply.

## Common issues

| Symptom | Fix |
|---------|-----|
| Redis ECONNREFUSED | Start Redis; check `REDIS_URL` |
| DB connection failed | Check `DATABASE_URL` |
| UI 404 on refresh | Run `npm run build:ui` |
| Workers not processing | Redis down; or run `npm run worker` in prod mode |

## Related Documentation

- [environment.md](environment.md)
- [workflows.md](workflows.md)
- [../troubleshooting/common-issues.md](../troubleshooting/common-issues.md)
