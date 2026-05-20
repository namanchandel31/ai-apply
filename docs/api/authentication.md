# Authentication API

| Method | Path | Auth |
|--------|------|------|
| POST | `/auth/signup` | None |
| POST | `/auth/login` | None |

## Response (login)

```json
{
  "data": {
    "token": "<jwt>",
    "user": { "id": "uuid", "email": "user@example.com" }
  }
}
```

## Related Documentation

- [../backend/auth.md](../backend/auth.md)
