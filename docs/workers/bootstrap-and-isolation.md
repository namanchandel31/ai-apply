# Worker bootstrap and isolation

**Source:** [`queue.config.js`](../../src/config/queue.config.js), [`index.js`](../../index.js).

## Modes

| Mode | When |
|------|------|
| **combined** | `WORKER_MODE=combined` or `npm start` (`bootstrap.js`) — recommended for current Render deploy |
| **inline** | `NODE_ENV=development`, API process, not worker argv |
| **separate** | Split API (`npm run start:api`) + worker (`npm run worker`) — use when scaling |

`workerDeploymentMode()` returns `combined` | `inline` | `separate`.

## Production

**Default (current scale):** combined — API + workers in one process via `bootstrap.js`.

**Scale-out:** split into dedicated API and worker service(s); scale worker replicas independently.

## Development

`npm run dev` starts inline workers for fast feedback.

## Isolation benefit

API memory/CPU not contended with LLM/SMTP; crash in worker does not kill HTTP (in separate mode).

## Related Documentation

- [../deployment/production-startup-order.md](../deployment/production-startup-order.md)
- [../development/environment.md](../development/environment.md)
