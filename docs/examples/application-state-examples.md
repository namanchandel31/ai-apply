# Application state examples

**Source:** [`applicationSerializer.js`](../../src/services/applicationSerializer.js), `resolveUiStatus` pipeline.

## Serialized application (shape)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "generated",
  "uiStatus": "generated",
  "terminal": false,
  "executionTerminal": false,
  "pollable": false,
  "canRetry": false,
  "canContinue": false,
  "reviewReason": null,
  "lastError": null,
  "retryCount": 0,
  "emailSubject": "Application for Software Engineer",
  "emailBody": "Dear hiring manager,...",
  "role": "Software Engineer",
  "company": "Acme Corp"
}
```

`status` = business enum. `uiStatus` = derived (may differ when jobs active).

## Active processing example

When latest `ai_process` job is `processing`:

- `status` may still be `draft`
- `uiStatus` → `processing`
- `pollable` → `true`

## Active sending example

When latest `send_email` job is `processing`:

- `status` → `generated`
- `uiStatus` → `sending`
- `pollable` → `true`

## Related Documentation

- [../architecture/state-model.md](../architecture/state-model.md)
- [../frontend/ui-status-rendering.md](../frontend/ui-status-rendering.md)
