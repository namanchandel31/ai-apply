# JWT replay limitation

JWT tokens are stateless — no server-side revocation until expiry (7 days).

## Risk

Stolen token can be replayed until expiration.

## Mitigations today

- HTTPS in production
- Minimal JWT payload (`userId` only)
- Short-term: rotate `JWT_SECRET` forces re-login for all users

## Future

Session store or token blacklist — see [../roadmap/future-architecture.md](../roadmap/future-architecture.md).

## Related Documentation

- [../backend/auth.md](../backend/auth.md)
