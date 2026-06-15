# OneTap Chrome Extension (MVP)

Load unpacked in Chrome: `chrome://extensions` → Developer mode → Load unpacked → select this `extension/` folder.

## Configuration

### 1. Supabase (for token refresh)

Copy values from `client/.env` into [`src/config/app.config.js`](src/config/app.config.js):

- `VITE_SUPABASE_URL` → `SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` → `SUPABASE_ANON_KEY`

See [`src/config/app.config.example.js`](src/config/app.config.example.js) for the template.

### 1b. Environment (dev vs production)

`app.config.js` exposes an `ENVIRONMENT` switch (`"development"` | `"production"`).
`DEFAULT_API_BASE` is only a **fallback** — once connected, the extension uses the
API origin the website sent during the connect handshake. Flip `ENVIRONMENT` to
`"production"` (and set `ENVIRONMENTS.production.apiBase`) when testing/shipping
non-locally.

### 2. Website connect

1. Copy the extension ID from `chrome://extensions` into `client/.env` as `VITE_ONETAP_EXTENSION_ID`
2. Restart the Vite dev server
3. Log in at the OneTap website → **Settings → Chrome Extension** → **Connect Extension**

No manual JWT copy/paste.

## Auth (Phase 0.5b)

- Website mints a 90s connect token via `POST /api/extension/connect/init`
- Extension exchanges it via `POST /api/extension/connect/exchange`
- Session stored in `chrome.storage.local`; tokens refresh automatically (on-demand + 50min alarm)
- Web sign-out sends `ONETAP_DISCONNECT` to clear extension credentials

See [`docs/product/extension-auth.md`](../docs/product/extension-auth.md).

## Features

- Setup gating via `GET /api/user/setup-status`
- Popup status via `GET /api/extension/popup-status` (cached locally for instant popup)
- LinkedIn post scoring from `GET /api/extension/detection-config`
- `POST /api/auto-apply` with source metadata on button click

## LinkedIn button

Hiring posts that score above the detection threshold (email + hiring keywords) show an **Add to OneTap** button inside the post.

Detection is **content-anchored**, not class-based: the content script walks the DOM
for posts containing a contact email, climbs to the enclosing single-post block,
scores it, and injects the button. This is resilient to LinkedIn's Server-Driven UI
(content-hashed class names like `edb9dae4`), so there are no `feed-shared-update-v2` /
`data-urn` selectors to keep up to date. Detection thresholds/keywords are managed in
the web **Admin console → Extension detection** tab.

If you don't see buttons:
1. Confirm extension is **Connected** (popup + Settings page)
2. Confirm **Setup complete** in the popup
3. **Reload the LinkedIn tab** after connecting (or scroll the feed — new posts are scanned automatically)
4. Open DevTools on LinkedIn → Console and look for `[OneTap]` messages

## Production / Chrome Web Store build

> **Placeholder domain:** every production origin below uses `onetap.app` as a
> placeholder. Before deploying, replace it with the real deployed domain (API +
> website). Search the repo for `onetap.app` to find every occurrence.

### Pre-deploy checklist (things to take care of)

1. **API origin** — set the production API URL in
   [`src/config/app.config.js`](src/config/app.config.js):
   `ENVIRONMENTS.production.apiBase` (currently `https://api.onetap.app`).
   This is only a fallback; the live value comes from the website connect
   handshake, so the website's `VITE_API_BASE` must point at the same origin.
2. **Environment switch** — set `ENVIRONMENT = "production"` in `app.config.js`.
3. **`manifest.json` `host_permissions`** — currently includes both
   `http://localhost:*` (testing) and `https://api.onetap.app` /
   `https://*.onetap.app` (production). For a Web Store submission, **remove the
   `localhost` entries** and keep only the production API origin + LinkedIn hosts.
   Update the `onetap.app` placeholder to the real domain.
4. **`manifest.json` `externally_connectable.matches`** — restricts which sites can
   message the extension. Keep only the production website origin
   (`https://*.onetap.app`); drop the `http://localhost:*` entry for the store build.
5. **Supabase** — confirm `SUPABASE_URL` / `SUPABASE_ANON_KEY` in `app.config.js`
   match the production Supabase project (token refresh uses these).
6. **Extension ID** — after publishing, set the published extension ID in the
   production website env (`VITE_ONETAP_EXTENSION_ID`) so the website targets the
   right extension during connect.

### Where `onetap.app` appears (replace all)

- `manifest.json` → `host_permissions` and `externally_connectable.matches`
- `src/config/app.config.js` → `ENVIRONMENTS.production.apiBase`
- `src/config/app.config.example.js` → same field in the template
