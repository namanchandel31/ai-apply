# Database pool lifecycle

## Singleton per process

[`src/db.js`](../../src/db.js) stores one `pg.Pool` on `global.__aiApplyPgPool` per Node process.

| Process | `POOL_OWNER` | Expected |
|---------|--------------|----------|
| API (`index.js`) | `api` | One `POOL_CREATED` at boot; `POOL_REUSED` on hot reload |
| Worker (`src/workers/index.js`) | `worker` | Separate process → separate pool |
| Migrations | `migration` | Ephemeral pool in `runMigration.js` (not global singleton) |

## Metrics interpretation

`poolTotal` dropping (e.g. 10 → 1 → 0) usually reflects **idle connection release**, not pool destruction. Confirm via logs:

- `POOL_CREATED` should appear once per process lifetime
- `POOL_REUSED` on subsequent `require("../db")` in the same process
- No repeated `POOL_CREATED` without process restart

## Logs

- `POOL_CREATED` / `PG_POOL_CREATED` — new pool
- `POOL_REUSED` — singleton hit
- `POOL_METRICS` — pressure snapshot with `poolOwner`
