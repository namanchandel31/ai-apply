# Testing

## Commands

| Command | Scope |
|---------|-------|
| `npm test` | Full Jest suite (~213 tests) |
| `npm run test:unit` | JD parser unit |
| `npm run test:integration` | JD parser integration script |
| `npm run test:middleware` | Middleware tests |

## Test environment

`tests/setup.js` sets `NODE_ENV=test`, `DATABASE_URL`, `REDIS_URL`, `INTERNAL_API_KEY`, etc. Tests do not start inline workers.

## Notable suites

| Path | Covers |
|------|--------|
| `tests/config/` | Env validation, config boundary (no scattered `process.env`) |
| `tests/orchestration/` | Logging policy, reconciliation |
| `tests/db.poolResilience.test.js` | Pool config |

## Before PR

```bash
npm test
npm run build:ui   # if client touched
```

## Related Documentation

- [conventions.md](conventions.md)
- [../architecture/source-of-truth-hierarchy.md](../architecture/source-of-truth-hierarchy.md)
