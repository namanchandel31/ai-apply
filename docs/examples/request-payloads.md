# Request payload examples

**Source:** route controllers and API client [`client/src/lib/api.ts`](../../client/src/lib/api.ts).

## POST /auth/signup

```json
{ "email": "user@example.com", "password": "secretpass123" }
```

## POST /api/auto-apply

```json
{ "jobDescriptionText": "We are hiring..." }
```

Response: **202** with application id.

## POST /api/applications/:id/continue

```json
{ "contactEmail": "hiring@company.com" }
```

Optional header: `Idempotency-Key: <uuid>` (60s dedup window).

## POST /api/save-email-credentials

```json
{
  "email": "user@gmail.com",
  "appPassword": "xxxx xxxx xxxx xxxx"
}
```

## Related Documentation

- [../api/README.md](../api/README.md)
- [../api/auto-apply-and-send.md](../api/auto-apply-and-send.md)
