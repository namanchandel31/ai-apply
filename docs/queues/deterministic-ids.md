# Deterministic job IDs

**Source:** enqueue helpers in queue modules.

```txt
process:application:{applicationId}
send:application:{applicationId}
```

## Behavior

Re-adding a job with the same ID while status is `waiting`, `delayed`, or `active` is a **no-op** — prevents duplicate workers on same phase.

## Why it matters

| Without | With |
|---------|------|
| Double LLM on retry storm | Single active process job |
| Duplicate SMTP | Single active send job |
| Recovery + user click race | Deduped enqueue |

## Related Documentation

- [../adr/002-deterministic-job-ids.md](../adr/002-deterministic-job-ids.md)
- [../examples/queue-jobs.md](../examples/queue-jobs.md)
