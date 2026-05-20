# API client

[`client/src/lib/api.ts`](../../client/src/lib/api.ts) — fetch wrapper with JWT in `localStorage`.

## Patterns

- `api.setToken` / `api.getToken`
- Throws on non-OK with message from error body
- Base URL: same origin in production build

## Status poll

`GET /api/applications/:id/status` with optional `If-None-Match` for ETag.

## Related Documentation

- [../api/README.md](../api/README.md)
- [status-and-polling.md](status-and-polling.md)
