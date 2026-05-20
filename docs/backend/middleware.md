# Middleware

Order defined in [`index.js`](../../index.js).

| Middleware | Purpose |
|------------|---------|
| `tracingMiddleware` | `req.requestId` |
| `pino-http` | Access logs |
| `cors`, `json` | Standard |
| `*RateLimit` | Tiered limits |
| `authMiddleware` | JWT verify on `/api/*` |

## Rate limits

See [../architecture/request-lifecycle.md](../architecture/request-lifecycle.md).

## Related Documentation

- [auth.md](auth.md)
