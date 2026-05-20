# UI status rendering

[`ApplicationTable.tsx`](../../client/src/components/ApplicationTable.tsx) uses API fields — **not** raw DB enums alone.

## Use from API

| Field | UI behavior |
|-------|-------------|
| `uiStatus` | Badge label |
| `pollable` | Include in poll set |
| `terminal` | Stop automation UI |
| `canRetry` | Show retry button |
| `canContinue` | Show continue (needs_review) |
| `reviewReason` | Explain review state |

## Anti-pattern

Hardcoding `if (status === 'failed')` without checking `uiStatus` / capabilities — breaks during active retries.

## Related Documentation

- [../architecture/state-model.md](../architecture/state-model.md)
- [../examples/application-state-examples.md](../examples/application-state-examples.md)
