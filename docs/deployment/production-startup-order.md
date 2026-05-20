# Production startup order

1. **PostgreSQL** — reachable, migrations applied (`npm run migrate`)
2. **Redis** — reachable at `REDIS_URL`
3. **Secrets** — env configured per [environment.md](../development/environment.md)
4. **API** — `npm run build:ui` then `npm start`
5. **Workers** — `npm run worker` (one or more replicas)
6. **Verify** — `/health`, `/internal/queue-health`

Never run inline workers in production (`NODE_ENV=production`).

## Related Documentation

- [deploy-safety.md](deploy-safety.md)
- [docker-pm2-examples.md](docker-pm2-examples.md)
