# Worker bootstrap and isolation

**Source:** [`queue.config.js`](../../src/config/queue.config.js), [`index.js`](../../index.js).

## Modes

| Mode | When |
|------|------|
| **inline** | `NODE_ENV=development`, API process, not worker argv |
| **separate** | Production API, or `npm run worker` |

`workerDeploymentMode()` returns `inline` | `separate`.

## Production

- API: **never** loads worker modules
- Workers: dedicated process(es), scale replicas

## Development

`npm run dev` starts inline workers for fast feedback.

## Isolation benefit

API memory/CPU not contended with LLM/SMTP; crash in worker does not kill HTTP (in separate mode).

## Related Documentation

- [../deployment/production-startup-order.md](../deployment/production-startup-order.md)
- [../development/environment.md](../development/environment.md)
