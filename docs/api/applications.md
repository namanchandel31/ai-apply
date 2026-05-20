# Applications API

All require JWT.

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/applications` | List |
| GET | `/api/applications/:id` | Detail + serialized status |
| GET | `/api/applications/:id/status` | Poll-optimized; ETag |
| POST | `/api/applications/:id/continue` | needs_review → send |
| POST | `/api/applications/:id/retry` | Retry workflow |
| POST | `/api/applications/:id/cancel` | Cancel |
| GET | `/api/application-jobs/:id` | Job detail |

## Status response

Includes `status`, `uiStatus`, `pollable`, `terminal`, `canRetry`, `canContinue`.

**Source:** `applicationSerializer`.

## Related Documentation

- [../examples/application-state-examples.md](../examples/application-state-examples.md)
