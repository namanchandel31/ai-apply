# Developer workflows

## Daily loop

```bash
npm run dev          # API + inline workers
# edit code
npm test             # before PR
npm run build:ui     # after client changes
```

## Database

```bash
npm run migrate                    # apply new SQL files
npm run migrate:baseline           # schema_migrations baseline (if needed)
```

Add SQL in `src/migrations/` with next sequence number.

## Debugging

| Scope | Env |
|-------|-----|
| Orchestration/SSE/reconcile | `DEBUG=orchestration` |
| SQL shape / pool | `DEBUG=query` |
| LLM gateway | `DEBUG=llm` |

Client: `VITE_DEBUG=orchestration` in `client/.env`.

## Internal endpoints

```bash
curl -H "x-internal-api-key: $INTERNAL_API_KEY" http://localhost:5000/internal/queue-health
```

## OpenAPI (dev only)

- UI: `http://localhost:5000/docs`
- Spec: `http://localhost:5000/openapi.json`

## Related Documentation

- [local-setup.md](local-setup.md)
- [testing.md](testing.md)
- [documentation-governance.md](documentation-governance.md)
