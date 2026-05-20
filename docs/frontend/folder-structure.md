# Frontend folder structure

```
client/src/
  App.tsx              # Auth shell + page routing
  main.tsx             # Entry
  pages/               # dashboard, applications, setup
  components/          # UI + ApplicationTable
  contexts/            # RealtimeProvider
  hooks/               # useApplicationStatusPoll, useSetupStatus
  lib/                 # api.ts, pollLoopLogic, shouldPoll
  services/
    realtime/          # SSE, reconciliation, cache
    orchestration/     # registry, leader, broadcast
    logging/           # debugFlags, orchestrationLogger
  constants/           # polling intervals
  config/              # logging.config.ts
```

## Related Documentation

- [routing-and-pages.md](routing-and-pages.md)
