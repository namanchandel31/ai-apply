# AI Apply

Automated job application platform: parse resume and job description, generate a tailored outreach email, send via Gmail. Async-first architecture with BullMQ workers and realtime status updates.

## Documentation

**Full engineering docs:** [docs/README.md](docs/README.md)

| Audience | Start here |
|----------|------------|
| New developer | [docs/README.md](docs/README.md) → role-based paths |
| Backend | [docs/architecture/system-overview.md](docs/architecture/system-overview.md) |
| Frontend | [docs/frontend/README.md](docs/frontend/README.md) |
| DevOps / on-call | [docs/deployment/production-startup-order.md](docs/deployment/production-startup-order.md) |

## Quick start

```bash
npm install
cp .env.example .env   # DATABASE_URL, REDIS_URL, ENCRYPTION_KEY, SUPABASE_*, etc.
cp client/.env.example client/.env   # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm run migrate
cd client && npm install && cd ..
npm run build:ui
npm run dev            # API + inline workers (development)
```

Open **http://localhost:5000**. Details: [docs/development/local-setup.md](docs/development/local-setup.md).

Production workers: `npm run worker` (separate process). See [docs/workers/bootstrap-and-isolation.md](docs/workers/bootstrap-and-isolation.md).

## Environment

See [`.env.example`](.env.example) and [docs/development/environment.md](docs/development/environment.md). AI defaults (`openai`, `gpt-4.1-mini`) and worker concurrency are **code constants**, not env vars.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | API + inline workers (dev) |
| `npm run dev:client` | Vite dev server (5173) |
| `npm run build:ui` | Build UI to `public/` |
| `npm start` | Production API |
| `npm run worker` | BullMQ workers |
| `npm run migrate` | SQL migrations |
| `npm test` | Jest |

## API

Dev OpenAPI: **http://localhost:5000/docs**. Reference: [docs/api/README.md](docs/api/README.md).

## Architecture (summary)

```txt
applications       = business truth
application_jobs   = execution truth
application_events = audit truth
uiStatus           = derived truth
```

[docs/architecture/state-model.md](docs/architecture/state-model.md)

## Security

- JWT auth (7-day expiry) — [docs/security/replay-attack-limitation.md](docs/security/replay-attack-limitation.md)
- Encrypted credentials (`ENCRYPTION_KEY`)
- Per-user data isolation

## License

ISC
