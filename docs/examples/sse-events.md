# SSE event examples

**Source:** [`sseFormat.js`](../../src/realtime/sseFormat.js).

## Frame format

```txt
event: application.updated
data: {"applicationId":"...","version":12,"orchestrationEpoch":1,...}

```

Heartbeat (comment line):

```txt
: heartbeat

```

## Code formatter

```javascript
// formatSseEvent(eventName, data) =>
`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`
```

## Client handling

Parsed in `client/src/services/realtime/events/parseSseFrame.ts` → normalized in `normalizeApplicationEvent.ts` → applied via `shouldApplyEvent`.

## Related Documentation

- [../architecture/realtime-architecture.md](../architecture/realtime-architecture.md)
- [../frontend/realtime-orchestration.md](../frontend/realtime-orchestration.md)
