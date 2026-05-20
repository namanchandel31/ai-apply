# Send worker

**File:** [`sendApplication.worker.js`](../../src/workers/sendApplication.worker.js)

## Responsibilities

1. Load application + user SMTP creds (decrypted)
2. `nodemailer` via [`mail.config.js`](../../src/config/mail.config.js) Gmail transport
3. CAS `generated` → `sent` on success (`markSentFromGenerated`)
4. Update job row, append `email_sent` event
5. Publish realtime

## Guards

- `hasCompletedSendJob` — no duplicate send after completed send job
- `UnrecoverableError` when prerequisites missing

## Related Documentation

- [../examples/worker-logs.md](../examples/worker-logs.md)
- [../backend/transactions-and-cas.md](../backend/transactions-and-cas.md)
