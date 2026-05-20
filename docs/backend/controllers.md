# Controllers

Thin HTTP adapters in `src/controllers/`.

## Contract

```txt
validate → auth → persist (minimal) → enqueue → respond
```

| Do | Don't |
|----|-------|
| Return 202 for async work | Call OpenAI synchronously |
| Use command services | CAS-heavy multi-step logic inline |
| Map errors to HTTP codes | Swallow CAS failures |

## Key controllers

| Controller | Endpoints |
|------------|-----------|
| `autoApplyController` | POST auto-apply |
| `applicationController` | list, status, continue, retry, cancel |
| `sendController` | queue send |
| `credentialController` | Gmail creds verify + save |
| `aiCredentialController` | BYOK CRUD |
| `realtimeController` | SSE stream |
| `orchestrationController` | active snapshot |

## Related Documentation

- [../api/README.md](../api/README.md)
- [../adr/004-thin-controller-architecture.md](../adr/004-thin-controller-architecture.md)
