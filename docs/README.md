# AI Apply — Engineering Documentation

Production-grade documentation for the AI Apply platform. This is the **single entry point** for engineers, operators, and contributors.

**Read time:** ~15 minutes for orientation; role paths below are curated to avoid navigating 70+ files blindly.

## What this system does

AI Apply automates job applications: parse resume and job description, score match, generate outreach email, send via user Gmail credentials. The platform is **async-first**: HTTP enqueues work; BullMQ workers own AI and SMTP; the UI derives status from business + execution state.

## Four-layer truth model

```txt
applications = business truth
application_jobs = execution truth
application_events = audit truth
uiStatus = derived truth (never persisted)
```

See [architecture/state-model.md](architecture/state-model.md) and [architecture/system-invariants.md](architecture/system-invariants.md).

## Role-based onboarding

### Backend engineer (~75 min)

1. [glossary.md](glossary.md) — domain terms
2. [architecture/system-overview.md](architecture/system-overview.md)
3. [architecture/state-model.md](architecture/state-model.md)
4. [architecture/system-invariants.md](architecture/system-invariants.md)
5. [architecture/ownership-boundaries.md](architecture/ownership-boundaries.md)
6. [architecture/async-processing.md](architecture/async-processing.md)
7. [queues/README.md](queues/README.md) → [workers/README.md](workers/README.md)
8. [backend/controllers.md](backend/controllers.md)

### Frontend engineer (~60 min)

1. [glossary.md](glossary.md) — especially `uiStatus`, `pollable`, `terminal`
2. [architecture/state-model.md](architecture/state-model.md) — derived truth
3. [frontend/status-and-polling.md](frontend/status-and-polling.md)
4. [frontend/realtime-orchestration.md](frontend/realtime-orchestration.md)
5. [frontend/ui-status-rendering.md](frontend/ui-status-rendering.md)
6. [examples/sse-events.md](examples/sse-events.md)

### DevOps / on-call (~45 min)

1. [development/local-setup.md](development/local-setup.md)
2. [deployment/production-startup-order.md](deployment/production-startup-order.md)
3. [observability/runtime-expectations.md](observability/runtime-expectations.md)
4. [troubleshooting/common-issues.md](troubleshooting/common-issues.md)
5. Runbooks under [troubleshooting/runbooks/](troubleshooting/runbooks/)

### New contributor (~45 min)

1. [glossary.md](glossary.md)
2. [architecture/system-overview.md](architecture/system-overview.md)
3. [development/conventions.md](development/conventions.md)
4. [development/anti-patterns.md](development/anti-patterns.md)
5. [development/local-setup.md](development/local-setup.md)
6. [development/workflows.md](development/workflows.md)

## Quick start (local)

```bash
npm install
cp .env.example .env   # configure DATABASE_URL, REDIS_URL, JWT_SECRET, etc.
npm run migrate
cd client && npm install && cd ..
npm run build:ui
npm run dev            # API + inline workers in development
```

See [development/local-setup.md](development/local-setup.md) for prerequisites and troubleshooting.

## Documentation map

| Section | Purpose |
|---------|---------|
| [architecture/](architecture/) | System design, invariants, lifecycles |
| [adr/](adr/) | Architecture Decision Records |
| [backend/](backend/) | Controllers, services, CAS, recovery |
| [frontend/](frontend/) | UI, polling, SSE, orchestration |
| [database/](database/) | Schema, migrations, indexes |
| [queues/](queues/) | BullMQ, retries, deterministic IDs |
| [workers/](workers/) | Process and send workers |
| [ai/](ai/) | Gateway, providers, timeouts |
| [api/](api/) | HTTP endpoints and error shapes |
| [examples/](examples/) | Real payloads and logs (code-sourced) |
| [deployment/](deployment/) | Production topology and safety |
| [observability/](observability/) | Logging, metrics, runtime SLAs |
| [development/](development/) | Setup, env, conventions, governance |
| [troubleshooting/](troubleshooting/) | Common issues and runbooks |
| [roadmap/](roadmap/) | Current vs future architecture |

## Governance

- **Source of truth:** [architecture/source-of-truth-hierarchy.md](architecture/source-of-truth-hierarchy.md) — code wins on conflict
- **When to update docs:** [development/documentation-governance.md](development/documentation-governance.md)
- **Forbidden patterns:** [development/anti-patterns.md](development/anti-patterns.md)

## Related Documentation

- Root product README: [../README.md](../README.md)
- Config reference: [development/environment.md](development/environment.md)
- Legacy doc redirects: former `docs/*.md` filenames point here
