# Services

Domain logic in `src/services/` (~31 modules).

## Layers

| Type | Examples |
|------|----------|
| Command | `applicationCommandService` — continue, retry, cancel |
| Query | `applicationStatusQueryService`, `applicationStatusForPoll` |
| Orchestration | `applicationOrchestrationService`, `orchestrationSnapshotService` |
| Transition | `transitionApplicationState`, `transitionJobState` |
| AI | `aiGateway`, `jobHandler`, `emailService` |
| Infra | `queueHealthService`, `mailService` |

## Module init

Avoid circular requires — see legacy RUNTIME notes: event contracts and query services extracted to break cycles (`applicationEvents`, `applicationStatusQueryService`).

## Related Documentation

- [transactions-and-cas.md](transactions-and-cas.md)
- [../ai/gateway-and-providers.md](../ai/gateway-and-providers.md)
