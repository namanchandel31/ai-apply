# Deployment architecture

```mermaid
flowchart TB
  LB[Load balancer]
  API1[API instance]
  API2[API instance]
  W1[Worker instances]
  Redis[(Redis)]
  PG[(PostgreSQL)]
  SB[Supabase storage]

  LB --> API1
  LB --> API2
  API1 --> Redis
  API2 --> Redis
  W1 --> Redis
  API1 --> PG
  W1 --> PG
  W1 --> SB
```

| Process | Responsibility |
|---------|----------------|
| API | HTTP + SSE + static UI |
| Worker | BullMQ consumers |
| Redis | Queues + realtime pub/sub |
| Postgres | State |
| Supabase | PDF storage |

## Related Documentation

- [production-startup-order.md](production-startup-order.md)
