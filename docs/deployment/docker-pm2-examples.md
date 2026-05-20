# Docker and PM2 examples

Reference only — repo does not ship production Dockerfile today.

## Docker Compose (reference)

```yaml
services:
  api:
    build: .
    command: npm start
    environment:
      NODE_ENV: production
    ports: ["5000:5000"]
    depends_on: [postgres, redis]
  worker:
    build: .
    command: npm run worker
    environment:
      NODE_ENV: production
    depends_on: [postgres, redis]
  redis:
    image: redis:7
  postgres:
    image: postgres:16
```

## PM2 (reference)

```json
{
  "apps": [
    { "name": "api", "script": "index.js", "instances": 2, "exec_mode": "cluster" },
    { "name": "worker", "script": "src/workers/index.js", "instances": 2 }
  ]
}
```

## Related Documentation

- [production-startup-order.md](production-startup-order.md)
