# AI pipeline

LLM operations via [`aiGateway.js`](../../src/services/aiGateway.js).

| Doc | Topic |
|-----|-------|
| [gateway-and-providers.md](gateway-and-providers.md) | Routing |
| [prompts-and-parsing.md](prompts-and-parsing.md) | Resume/JD/email |
| [timeouts-and-protection.md](timeouts-and-protection.md) | Circuit breaker |
| [byok-and-fallback.md](byok-and-fallback.md) | User keys |

## Platform defaults

`openai` + `gpt-4.1-mini` in `ai.config.js` — not env.

## Related Documentation

- [../workers/process-worker.md](../workers/process-worker.md)
- [../adr/005-worker-owned-ai-lifecycle.md](../adr/005-worker-owned-ai-lifecycle.md)
