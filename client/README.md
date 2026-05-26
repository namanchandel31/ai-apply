# AI Apply — frontend

React + Vite client. Deployed independently on Vercel.

## Local development

```bash
npm install
npm run dev
```

Runs at http://localhost:5173. API requests use `/api/*` proxied to the backend (default `http://localhost:5000`).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `VITE_API_URL` | Production | Backend origin without trailing slash |

## Vercel

| Setting | Value |
|---------|--------|
| Root Directory | `client` |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_URL` in the Vercel project environment.

SPA routing is handled by `vercel.json` (rewrite to `index.html`).

## Build

```bash
npm run build
```

Output: `client/dist/`
