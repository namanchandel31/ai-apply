# CAS failure examples

**Source:** `transitionApplicationState`, `markSentFromGenerated`.

## Send race (two workers)

1. Both workers finish SMTP near same time
2. First `markSentFromGenerated`: `generated` → `sent` succeeds
3. Second CAS: expected `generated`, actual `sent` → **failure surfaced**, not ignored
4. Second worker must not mark duplicate send as success

## Stale business transition

1. Controller expects `needs_review` → `generated`
2. Row already `generated` by worker
3. CAS returns no row updated → command returns conflict/error to client

## Operational signal

Repeated CAS failures in logs → investigate duplicate workers or manual DB edits.

## Related Documentation

- [../backend/transactions-and-cas.md](../backend/transactions-and-cas.md)
- [../adr/003-cas-state-transitions.md](../adr/003-cas-state-transitions.md)
