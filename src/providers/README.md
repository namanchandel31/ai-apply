# Provider adapters

Thin infrastructure adapters between `aiGateway` and external LLM APIs. **Not** domain services — no business rules here.

## Normalization contract (stable)

Every adapter returns this shape to the gateway:

```js
{
  parsed: object | null,
  text: string | null,
  raw: unknown,
  usage: { promptTokens, completionTokens, totalTokens },
  model: string,
  provider: string,
  latencyMs: number,
  estimatedCost: number | null,
}
```

`aiGateway` and business logic depend only on this contract. Upstream SDK/response changes are absorbed inside adapters.

## Adapter versioning (P1+)

Providers evolve independently:

- SDK breaking changes (OpenAI Responses vs Chat, etc.)
- Response shape mutations
- OpenAI-compatible endpoint divergence
- Anthropic/Gemini schema and safety behavior

### Future patterns

| Pattern | Purpose |
|---------|---------|
| `adapterVersion` export | e.g. `{ id: "openai", adapterVersion: "1.0.0" }` — log in telemetry |
| Versioned folders | `openai/v1/`, `openai/v2/` side by side during migrations |
| Capability snapshots | Hash of `capabilities` per version for audit |

**Rule:** Breaking adapter changes must not break the gateway public API. Add a new adapter version; keep normalization output compatible.

## Adding or changing an adapter

1. Implement `generateStructuredJson`, `generateText`, `healthCheck`, `estimateCost` (delegate pricing to `config/providerPricing.js`)
2. Set explicit `capabilities` flags in `capabilities.js` — do not default all to `true`
3. Use cheap health probes (models list preferred; no full completions for setup tests)
4. Map errors to `RetryableError` / `NonRetryableError` via `providerUtils.classifyProviderError`
5. Register in `index.js`
6. Add model prefix rules to `providerUtils.MODEL_PREFIXES` and pricing to `providerPricing.js`

## Remote vs local

| Type | IDs | API key | Execution (v1) |
|------|-----|---------|----------------|
| Remote | openai, openrouter, anthropic, gemini, grok, nvidia | Required | Supported |
| Local | ollama, lmstudio | Optional (`NULL` in DB) | Stub — `LOCAL_PROVIDER_NOT_IMPLEMENTED` |

Local providers use `base_url` + reachability health checks only until Phase 2 execution.

## Testing

See `tests/providers/README.md` for the P2 capability integration matrix strategy.
