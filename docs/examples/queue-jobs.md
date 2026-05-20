# Queue job examples

**Source:** [`processApplicationQueue.js`](../../src/queues/processApplicationQueue.js), [`sendApplicationQueue.js`](../../src/queues/sendApplicationQueue.js), enqueue helpers.

## Deterministic job IDs

```txt
process:application:550e8400-e29b-41d4-a716-446655440000
send:application:550e8400-e29b-41d4-a716-446655440000
```

## Process job data

```json
{
  "applicationId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "660e8400-e29b-41d4-a716-446655440001",
  "dbJobId": 42
}
```

## Send job data

```json
{
  "applicationId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "660e8400-e29b-41d4-a716-446655440001",
  "recipientEmail": "jobs@example.com",
  "dbJobId": 43
}
```

## Default job options (process queue)

| Option | Value |
|--------|-------|
| attempts | 3 (`PROCESS_JOB_MAX_ATTEMPTS`) |
| backoff | exponential, 2000 ms base |
| removeOnComplete | true |

## Related Documentation

- [../queues/deterministic-ids.md](../queues/deterministic-ids.md)
- [../adr/002-deterministic-job-ids.md](../adr/002-deterministic-job-ids.md)
