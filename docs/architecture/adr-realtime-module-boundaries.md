# ADR: Realtime module boundaries

## Status

Accepted — enforced via ESLint `no-restricted-imports` and typed public cache API.

## Ownership

| Module | Owns |
|--------|------|
| `client/src/services/realtime/cache/applicationCacheSync.ts` | All `setQueryData` / `invalidateQueries` for `["applications"]` |
| `client/src/services/realtime/reconciliation/shouldApplyRealtimeEvent.ts` | Apply/reject ordering (version → epoch → terminal → updatedAt display) |
| `client/src/services/realtime/cache/partialHydrationScheduler.ts` | Partial-row hydration fanout |
| `src/realtime/postCommitPublishQueue.js` | Post-commit publish lifecycle |
| `client/src/services/realtime/realtimeCoordinator.ts` | Transport, tab leader, hydrate **schedule**, event bus |
| `client/src/hooks/useApplicationStatusPoll.ts` | Poll fallback only (heal tier 3) |

## Public cache API

Import only from `cacheSyncApi.ts`:

- `applyRealtimeEventToCache`
- `applyPollStatusToCache`
- `scheduleListInvalidationFromApi`
- `runConvergenceHeal`

## Coordinator rules

- No direct React Query mutations.
- No duplicate version-gate logic outside `shouldApplyRealtimeEvent`.

## Review checklist

- [ ] New RQ mutations go through `applicationCacheSync` / `cacheSyncApi`
- [ ] Publish paths use post-commit queue (no `setImmediate` for correctness)
- [ ] Metrics tags: `reason`, `source`, `policy`, `stage` only — never `applicationId`
