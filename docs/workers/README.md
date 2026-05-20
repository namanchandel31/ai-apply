# Workers

BullMQ consumers in `src/workers/`.

| Doc | Topic |
|-----|-------|
| [process-worker.md](process-worker.md) | AI pipeline |
| [send-worker.md](send-worker.md) | SMTP |
| [bootstrap-and-isolation.md](bootstrap-and-isolation.md) | Dev inline vs prod separate |

## Entry

```bash
npm run worker
```

Loads [`workers/index.js`](../../src/workers/index.js) — both process and send workers.

## Related Documentation

- [../queues/README.md](../queues/README.md)
- [../adr/005-worker-owned-ai-lifecycle.md](../adr/005-worker-owned-ai-lifecycle.md)
