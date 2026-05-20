# ADR-002: Deterministic BullMQ job IDs

**Status:** accepted

## Context

Auto-apply and send can be triggered multiple times (retries, recovery, double-click). Non-deterministic IDs create duplicate active jobs.

## Problem

Duplicate workers processing the same application phase → double LLM spend, duplicate SMTP, race on CAS.

## Decision

Use deterministic BullMQ `jobId`:

```txt
process:application:{applicationId}
send:application:{applicationId}
```

Re-enqueue while job is `waiting`, `delayed`, or `active` is a no-op.

## Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| Random UUID per enqueue | Duplicates under retry/recovery |
| DB-only dedup | Race before row visible |
| Single queue for all work | Poor isolation and scaling |

## Tradeoffs

| Pro | Con |
|-----|-----|
| Idempotent enqueue | Cannot run two send jobs concurrently for same app (intended) |
| Safe recovery | Must change ID pattern if parallel sends ever required |

## Operational implications

- Logs should always include `applicationId` and BullMQ `jobId`.
- Deploy docs must warn against manual duplicate enqueue without cancel.

## Future considerations

- Priority queues may need suffix pattern (`send:application:{id}:priority`).
- Partitioned queues per tenant.

## Related Documentation

- [../queues/deterministic-ids.md](../queues/deterministic-ids.md)
- [../examples/queue-jobs.md](../examples/queue-jobs.md)
