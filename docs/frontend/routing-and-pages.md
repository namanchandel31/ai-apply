# Routing and pages

Single-page app with internal page state in `App.tsx` (`PageId`: dashboard, applications, setup).

| Page | Purpose |
|------|---------|
| **setup** | Resume upload, Gmail creds, AI creds |
| **dashboard** | Auto-apply entry |
| **applications** | `ApplicationTable` + status |

Auth: login/signup forms when no JWT in `api` client.

## Related Documentation

- [api-client.md](api-client.md)
