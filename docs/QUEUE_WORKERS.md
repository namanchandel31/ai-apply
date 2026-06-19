# Moved

Canonical documentation:

- [queues/README.md](queues/README.md)
- [workers/README.md](workers/README.md)
- [architecture/async-processing.md](architecture/async-processing.md)
- [deployment/render.md](deployment/render.md)

`WORKER_MODE` env: `combined` (recommended Render default) | `separate` (split API + worker) | `inline` (dev/test only).

Production on Render: single service (`npm start` / `bootstrap.js`). Split services remain supported for scale-out.
