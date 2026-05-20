# Coding conventions

Patterns aligned with the existing codebase.

## Structure

| Layer | Location | Naming |
|-------|----------|--------|
| Routes | `src/routes/*.js` | `*Routes.js` |
| Controllers | `src/controllers/` | `*Controller.js` |
| Services | `src/services/` | `*Service.js` or domain name |
| Models | `src/models/` | `*Model.js` |
| Workers | `src/workers/` | `*.worker.js` |
| Config | `src/config/` | `*.config.js` |

## Logging

- Use structured `logger` from `utils/logger.js`.
- Include `event` field (SCREAMING_SNAKE).
- Include `reqId`, `applicationId`, `userId` when available.
- Use `DEBUG=orchestration|query|llm` — no per-component env flags.

## Errors

- HTTP: `httpErrorResponse` / `response.js` helpers.
- Workers: `UnrecoverableError` for non-retryable failures.
- Classify LLM errors via `aiRetryPolicy.js`.

## State changes

- Business: `transitionApplicationState`.
- Jobs: `transitionJobState`.
- Never raw `UPDATE applications SET application_status` in feature code.

## Queues

- Enqueue only after durable DB rows exist.
- Always use deterministic `jobId` for application-scoped jobs.

## Tests

- `npm test` — Jest unit/integration.
- Test env vars in `tests/setup.js` only.

## Related Documentation

- [anti-patterns.md](anti-patterns.md)
- [../architecture/system-invariants.md](../architecture/system-invariants.md)
- [testing.md](testing.md)
