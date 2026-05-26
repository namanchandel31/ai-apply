# API layer (`src/api/`)

HTTP boundary only: Express app creation and server startup.

| Module | Role |
|--------|------|
| `createApp.js` | Build Express app (routes, middleware, `/health`) |
| `startApi.js` | Listen on `PORT`, SSE gateway, recovery loop, queue validation |

Does **not** run BullMQ workers — see `src/workers/`.

Routes remain in `src/routes/`; business logic in `src/services/`; queues in `src/queues/`.
