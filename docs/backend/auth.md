# Authentication

JWT bearer tokens via [`authService.js`](../../src/services/authService.js).

## Flow

1. `POST /auth/signup` or `/auth/login`
2. Client stores token; sends `Authorization: Bearer <token>`
3. `authMiddleware` sets `req.userId`

## Token payload

Minimal: `{ userId }`. Expiry 7d. Issuer `ai-apply`.

## Limitations

- No revocation/blacklist yet — see [../security/replay-attack-limitation.md](../security/replay-attack-limitation.md)
- Rotate `JWT_SECRET` requires all users re-login

## Internal API

`x-internal-api-key` header for `/internal/*` — not JWT.

## Related Documentation

- [../api/authentication.md](../api/authentication.md)
