# Process worker

**File:** [`processApplication.worker.js`](../../src/workers/processApplication.worker.js)

## Responsibilities

1. Load application + resume + JD
2. Parse JD (LLM), match skills, generate email (LLM)
3. CAS business status → `generated` or `needs_review`
4. Insert `send_email` job + enqueue if contact email present
5. Append events, publish realtime

## Does not

- Send SMTP (send worker)
- Respond to HTTP

## Failure stages

`failureStage` metadata: parse, match, email_generation, etc.

## Related Documentation

- [../ai/prompts-and-parsing.md](../ai/prompts-and-parsing.md)
- [send-worker.md](send-worker.md)
