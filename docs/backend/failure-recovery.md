# Failure recovery

## User-facing commands

| Endpoint | Effect |
|----------|--------|
| `POST .../continue` | `needs_review` → enqueue send |
| `POST .../retry` | Re-open workflow, new job row |
| `POST .../cancel` | Terminal `cancelled` |

## System recovery

[`recovery.job.js`](../../src/jobs/recovery.job.js) — re-enqueue stuck jobs; skip review states.

## Safe failure persist

[`safePersistApplicationFailure.js`](../../src/services/safePersistApplicationFailure.js) — record failure without corrupting state.

## Dual failed semantics

- Job `failed` = attempt
- `application_status = failed` = workflow

See [../architecture/state-model.md](../architecture/state-model.md).

## Related Documentation

- [../examples/recovery-scenarios.md](../examples/recovery-scenarios.md)
- [../troubleshooting/common-issues.md](../troubleshooting/common-issues.md)
