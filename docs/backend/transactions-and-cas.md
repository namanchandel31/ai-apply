# Transactions and CAS

State mutations use compare-and-swap semantics.

## Business transitions

[`transitionApplicationState.js`](../../src/services/transitionApplicationState.js):

- Expected prior `application_status`
- Updates `orchestration_version` / `epoch` per bump rules
- Publishes realtime after commit

## Send CAS

[`markSentFromGenerated`](../../src/models/applicationModel.js) — only one worker wins `generated` → `sent`.

## Jobs

[`transitionJobState.js`](../../src/services/transitionJobState.js) — execution row updates.

> **Rule:** CAS failures must never be ignored.

## Idempotency

- Continue: `Idempotency-Key` header (60s)
- Enqueue: deterministic BullMQ IDs

## Related Documentation

- [../examples/cas-failure-examples.md](../examples/cas-failure-examples.md)
- [../adr/003-cas-state-transitions.md](../adr/003-cas-state-transitions.md)
