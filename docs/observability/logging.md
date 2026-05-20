# Logging

Pino via [`logger.js`](../../src/utils/logger.js).

## Conventions

- Field `event` — stable SCREAMING_SNAKE identifier
- Correlate with `reqId`, `applicationId`, `userId`
- HTTP via `pino-http` (skips `/health`)

## Levels

Controlled by `LOG_LEVEL`. Pretty print: `LOG_PRETTY` in dev.

## Dedupe

[`logDedupe.js`](../../src/utils/logDedupe.js) — bounds noisy orchestration warnings.

## Related Documentation

- [metrics-and-debug-scopes.md](metrics-and-debug-scopes.md)
- [../examples/worker-logs.md](../examples/worker-logs.md)
