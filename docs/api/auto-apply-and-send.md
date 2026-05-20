# Auto-apply and send API

## POST /api/auto-apply

Rate limited. Returns **202** with application id. Enqueues process job.

## POST /api/send-application/:applicationId

Queues send if email content ready. **202** when queued.

## POST /api/apply/

Legacy apply path — prefer auto-apply.

## Uploads

| Method | Path |
|--------|------|
| POST | `/api/upload-resume` |
| POST | `/api/upload-jd` |

## Related Documentation

- [../architecture/async-processing.md](../architecture/async-processing.md)
- [../examples/request-payloads.md](../examples/request-payloads.md)
