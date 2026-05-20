# Queue & worker architecture

## BullMQ queue names (must match exactly)

| Component | BullMQ queue | DB `job_type` |
| ----------- | ---------------- | ----------------- |
| Producer (auto-apply) | `process-application` | `ai_process` |
| Recovery re-enqueue | `process-application` | `ai_process` |
| Process worker | `process-application` | `ai_process` |
| Producer (after generate) | `send-application` | `send_email` |
| Send worker | `send-application` | `send_email` |

`ai_process` is the **database job type**, not the Redis queue name. Recovery logs include both `jobType` and `queueName` (BullMQ).

## Running locally

**Option A — inline (default in `.env.example`):**

```bash
npm run dev
```

Starts API + both workers when `WORKER_MODE=inline` and `NODE_ENV` is not `production`.

**Option B — separate process (production-like):**

```bash
npm run dev      # API only
npm run worker   # process-application + send-application consumers
```

## Observability

Startup logs: `QUEUE_SYSTEM_READY`, `WORKER_BOOTED`, `WORKER_READY`, `WORKER_CONNECTED`.

Per job: `JOB_RECEIVED`, `JOB_STARTED`, `JOB_COMPLETED`, `JOB_FAILED`, `JOB_STALLED`, `JOB_RETRIED`.

Recovery: `RECOVERY_QUEUE_METRICS` with waiting/active/failed counts.

Internal health: `GET /internal/queue-health` with `x-internal-api-key`.
