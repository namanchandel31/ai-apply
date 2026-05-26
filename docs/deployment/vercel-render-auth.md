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
| `INVALID_ISSUER` / `INVALID_AUDIENCE` | Align `SUPABASE_URL` on Render with frontend project; check `iss`/`aud` in JWT |
| `JWKS_FETCH_FAILED` | Render cannot reach Supabase JWKS — network or wrong `SUPABASE_URL` |
| `MISSING_AUTH_HEADER` | Session not ready — refresh; check Supabase env on Vercel |
| `EMAIL_NOT_VERIFIED` | Rare for Google — enable `AUTH_DEBUG=1` on Render and check `AUTH_EMAIL_REJECTED` logs |
| `AUTH_USER_SYNC_FAILED` (500) | JWT OK but DB user sync failed — check migrations / `DATABASE_URL` |
| CORS error (no 401) | Set `CORS_ORIGIN` on Render |

## Debug on Render

Set `AUTH_DEBUG=1` temporarily. Logs emit `AUTH_VERIFY_DEBUG` with decoded claim snapshot (no raw token). Disable after fixing.

## Debug (dev only)

- Frontend: `VITE_DEBUG_AUTH=1` logs `{ path, hasToken, apiBase }` (never the token).
- Backend: structured logs `AUTH_REJECTED`, `AUTH_VERIFY_FAILED` with `reason` and `code`.
