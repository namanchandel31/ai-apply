# Migrations

SQL migrations in `src/migrations/` applied in lexical order by `run-migrations.js`.

## Run

```bash
npm run migrate
```

## Conventions

| Rule | Detail |
|------|--------|
| Naming | `NNN_description.sql` |
| Idempotency | Prefer `IF NOT EXISTS` for indexes |
| Data backfill | Separate migration or documented step |
| Enums | Add values in dedicated migration before use |

## Key migrations

| File | Effect |
|------|--------|
| 002 | `applications` |
| 011b | `application_jobs`, `application_events`, lifecycle enum |
| 012 | Recovery indexes |
| 013 | Status poll indexes |
| 014 | `orchestration_version`, `orchestration_epoch` |

## Baseline

`npm run migrate:baseline` — `scripts/baselineSchemaMigrations.js` for existing DBs.

## Related Documentation

- [schema.md](schema.md)
- [../development/workflows.md](../development/workflows.md)
