# Vercel frontend + Render backend auth

## Checklist

### Vercel (frontend)

| Variable | Example |
|----------|---------|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_API_URL` | `https://your-service.onrender.com` (no trailing slash) |

Redeploy after changing `VITE_*` — they are baked in at build time.

### Render (backend)

| Variable | Must match |
|----------|------------|
| `SUPABASE_URL` | Same Supabase project as `VITE_SUPABASE_URL` |
| `CORS_ORIGIN` | Your Vercel URL(s), comma-separated |

### Supabase Dashboard

- **Authentication → URL Configuration**: add Vercel URL + `/auth/callback`
- **Google provider** enabled

## Verify in browser

1. Sign in with Google.
2. Network tab → `GET https://<render>/api/user/me`
3. Request headers must include `Authorization: Bearer eyJ...`
4. Response `200` with user JSON.

## Common 401 causes

| Symptom | Fix |
|---------|-----|
| Request URL is `vercel.app/api/...` | Set `VITE_API_URL` on Vercel |
| `INVALID_ISSUER` / `INVALID_AUDIENCE` | Align `SUPABASE_URL` on Render with frontend project |
| `MISSING_AUTH_HEADER` | Session not ready — refresh; check Supabase env on Vercel |
| `EMAIL_NOT_VERIFIED` | Backend email rules — ensure Google OAuth path (fixed in verifier) |
| CORS error (no 401) | Set `CORS_ORIGIN` on Render |

## Debug (dev only)

- Frontend: `VITE_DEBUG_AUTH=1` logs `{ path, hasToken, apiBase }` (never the token).
- Backend: structured logs `AUTH_REJECTED`, `AUTH_VERIFY_FAILED` with `reason` and `code`.
