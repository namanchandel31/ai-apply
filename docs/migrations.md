# Database migrations

## How it works

- SQL files live in [`src/migrations/`](../src/migrations/).
- Files are discovered in **lexicographic order** (see [`scripts/lib/discoverMigrations.js`](../scripts/lib/discoverMigrations.js)).
- **`npm run migrate`** runs [`run-migrations.js`](../run-migrations.js), which:
  1. Ensures a ledger table **`schema_migrations`** exists (`name` PK, `checksum`, `applied_at`).
  2. Takes a **PostgreSQL advisory lock** so two migrate processes do not run concurrently.
  3. For each `.sql` file: if `name` is already in `schema_migrations`, **skips** it; otherwise runs the file in a **single transaction** and inserts a row on success.

## Already-migrated databases (no ledger rows)

If the schema was applied manually or by an older runner without a ledger, **`npm run migrate` will try to run 001 onward again** and may fail on existing objects.

**Option A — baseline (recommended):** mark every file as applied without executing SQL (only if you are sure the DB matches the files):

```bash
npm run migrate:baseline
```

**Option B — manual:** insert rows into `schema_migrations` for each file name you know was applied.

## New environments

On an empty database, run:

```bash
npm run migrate
```

Each migration runs **once**. New files (e.g. `013_*.sql`) apply on the next run; older files are skipped.

## Idempotency

Migrations should remain safe when possible (`IF NOT EXISTS`, guarded `DO` blocks). The ledger is the primary guarantee against re-execution drift (e.g. columns renamed in later migrations).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run migrate` | Apply pending migrations using `schema_migrations` |
| `npm run migrate:baseline` | Record all current `.sql` files as applied (no SQL execution) |

## Contention script

For lock / activity sampling (optional):

```bash
node scripts/checkDbContention.js
```
