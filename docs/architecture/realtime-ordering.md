# Realtime ordering rules

## Primary: `version` (orchestration_version)

- Strictly monotonic per application
- Stale lower versions rejected at coordinator ingress
- Replay, SSE, and BroadcastChannel races: **higher version always wins**

## Secondary: `orchestrationEpoch`

- Revive boundaries; stale epoch rejected unless terminal resurrection rules apply

## Tertiary: `updatedAt` (display only)

- Merges `role` / `company` when monotonic
- Must not reject a higher `version` patch

## `eventId` (transport only)

| Field | Purpose | Must NOT |
|-------|---------|----------|
| `eventId` | `Last-Event-ID`, replay cursor, SSE `id:` line | Override version ordering |
| `version` | Business truth, cache winner | Be beaten by newer `eventId` with lower version |

## Terminal rules

- `terminal_resurrection` blocks passive downgrade without epoch bump
- Forward terminal transitions always apply
