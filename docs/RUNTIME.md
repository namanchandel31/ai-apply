# Runtime startup notes

## Dependency boundaries

Orchestration modules follow a one-way import graph:

```
contracts/ (applicationEvents)
  → services/ (applicationStatusQueryService, publishers)
  → realtime/ (realtimeDispatch, redisRealtimeBridge, sseGateway)
```

Leaf modules (`src/contracts/*`, `applicationStatusQueryService`) must not import publishers, transition layer, or transport.

CI enforces zero cycles: `tests/orchestration/circularDependencies.test.js` runs `madge --circular src`.

## DEP0169 — `url.parse()` deprecation

### Source (external)

Tracing with `node --trace-deprecation index.js` shows the warning originates from:

- [`parseurl`](https://www.npmjs.com/package/parseurl) (`node_modules/parseurl/index.js`) — uses Node legacy `url.parse()`
- Pulled by **Express** (`express/lib/request.js` → `require('parseurl')`)

There is **no `url.parse()` usage in `src/`** application code.

### Mitigation

| Action | Status |
|--------|--------|
| Upgrade Express / parseurl when upstream ships WHATWG `URL` parsing | Track releases |
| Global `--no-deprecation` / `NODE_NO_WARNINGS` | **Not used** — hides real issues |
| App-level replacement of Express URL parsing | Out of scope |

The warning is **benign at runtime** today; request routing continues to work. Re-evaluate when upgrading Node major versions where legacy `url.parse` may be removed.

### Re-trace locally

```bash
node --trace-deprecation index.js
```

Expect stack frames under `parseurl` and `express`, not under `src/`.
