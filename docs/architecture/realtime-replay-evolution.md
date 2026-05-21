# Realtime replay evolution (v2 design notes)

v1 does **not** implement a server-side replay buffer. This document reserves fields and semantics so v2 does not require a coordinator rewrite.

## Expectation

Bounded catch-up after reconnect — not full event sourcing. The database remains the write source of truth; replay is read-side only.

## Reconnect cursor (client)

Per application:

- `lastSeenVersion`
- `lastSeenEpoch`
- `lastEventAt`

Optional global `streamCursor` when transport moves to Redis Streams / Kafka.

## Missed-event detection (v2)

Gap when `hydrate.version > lastSeenVersion + 1`, or when `eventSequence` (payload schema v2) has a hole.

## Bounded replay (v2)

Server replays last N events or snapshot+delta since cursor. Cap: `MAX_REPLAY_EVENTS = 100`.

## Transport pluggability

`fanOutRealtimePayload` and the Redis bridge can subscribe to a stream consumer; checkpoints live client-side plus optional server session table.

## Payload compatibility

v1 payloads include `version`, `orchestrationEpoch`; v2 adds optional monotonic `sequence` (nullable in v1). The version gate and cache sync modules stay unchanged.
