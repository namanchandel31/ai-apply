# Errors and status codes

Structured errors from [`response.js`](../../src/utils/response.js) / [`httpErrorResponse.js`](../../src/utils/httpErrorResponse.js).

## Common codes

| Code | When |
|------|------|
| 400 | Validation, bad email, CAS conflict |
| 401 | Missing/invalid JWT |
| 402 | Rate limit (auto-apply) |
| 404 | Not found / wrong user |
| 409 | Conflict (active job, duplicate) |
| 202 | Accepted — async work queued |
| 304 | Status ETag match |

## Error body shape

```json
{
  "error": true,
  "code": "BAD_REQUEST",
  "message": "Human-readable message"
}
```

## Related Documentation

- [../development/conventions.md](../development/conventions.md)
