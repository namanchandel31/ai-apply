# Deploy safety

## Queue safety

- Deterministic job IDs prevent duplicate active jobs after deploy
- Prefer draining workers: stop workers → wait for active jobs → deploy → start workers
- API can roll without worker stop if workers compatible with job payload schema

## Schema migrations

- Run migrations **before** new code that depends on columns
- Backward-compatible migrations when rolling API first

## Realtime

- Multiple API instances require Redis pub/sub
- SSE clients reconnect automatically; brief duplicate events reconciled by version

## Rollback

- Revert code; avoid down migrations in production without playbook
- Check `application_jobs` stuck in `processing` after bad deploy — run recovery

## Related Documentation

- [../database/migrations.md](../database/migrations.md)
- [../troubleshooting/runbooks/stuck-jobs.md](../troubleshooting/runbooks/stuck-jobs.md)
