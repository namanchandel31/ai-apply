# Worker log examples

**Source:** `utils/logger.js` event names used in workers and queues.

## Lifecycle

```json
{ "event": "JOB_RECEIVED", "applicationId": "...", "jobType": "ai_process" }
{ "event": "JOB_STARTED", "applicationId": "..." }
{ "event": "JOB_COMPLETED", "applicationId": "..." }
```

## Failures

```json
{ "event": "JOB_FAILED", "applicationId": "...", "error_message": "..." }
{ "event": "JOB_STALLED", "applicationId": "..." }
```

## Application milestones

```json
{ "event": "application_sent", "applicationId": "...", "messageId": "<smtp-id>" }
```

## Queue system

```json
{ "event": "QUEUE_SYSTEM_READY" }
{ "event": "WORKER_READY", "queue": "process-application" }
```

## Related Documentation

- [../observability/logging.md](../observability/logging.md)
- [../queues/README.md](../queues/README.md)
