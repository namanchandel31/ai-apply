# Status and polling

[`useApplicationStatusPoll`](../../client/src/hooks/useApplicationStatusPoll.ts) + [`pollLoopLogic.ts`](../../client/src/lib/pollLoopLogic.ts).

## Intervals

| Mode | MS |
|------|-----|
| SSE down | 3000 |
| SSE up (fallback) | 30000 |
| Max duration | 180000 |

## Rules

- Use API `pollable` — do not poll terminal/non-pollable apps
- Backoff on errors (`POLL_BACKOFF_*`)
- Concurrency: `STATUS_POLL_CONCURRENCY = 3`

## ETag

304 responses skip state update — reduces load.

## Related Documentation

- [../observability/runtime-expectations.md](../observability/runtime-expectations.md)
- [ui-status-rendering.md](ui-status-rendering.md)
