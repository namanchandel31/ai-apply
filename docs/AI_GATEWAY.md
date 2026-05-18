# AI Gateway

AI orchestration infrastructure for AI Apply. Business logic must never call provider SDKs directly.

## Operational philosophy

- **Providers are infrastructure** — thin adapters under `src/providers/`
- **Business logic stays provider-agnostic** — pass prompts, task, `userId`, optional `promptVersion`
- **`aiGateway` is execution orchestration** — not domain logic
- **Adapters are thin normalization layers** — absorb upstream API drift; gateway contract stays stable
- **Goal:** portability across providers, models, async workers, and future local runtimes

## Public API (v1 — intentionally flat)

v1 uses flat parameters for migration simplicity:

- `generateStructuredJson({ userId, task, systemPrompt, userPrompt, promptVersion?, model?, ... })`
- `generateText(...)`
- `healthCheck({ userId, provider?, apiKey?, baseUrl? })` — cheap probes only
- `estimateCost({ provider, model, usage })` — via `src/config/providerPricing.js`

### Future: `AiExecutionRequest` (P1+)

Long-term, converge on one normalized request object to avoid parameter explosion across controllers and workers:

```ts
type AiExecutionRequest = {
  userId: string;
  reqId?: string;
  jobId?: string;
  aiRequestId?: string;           // P2 idempotency
  task: "resume_parse" | "jd_parse" | "email_generate" | "health_check";
  endpoint?: string;
  systemPrompt: string;
  userPrompt: string;
  promptVersion?: string;
  model?: string;
  provider?: string;
  userFallbackProviders?: string[];
  timeoutMs?: number;
  maxAttempts?: number;
  signal?: AbortSignal;
  telemetry?: { tags?: Record<string, string> };
  // allowPlatformFallback usually from credential row, not per-call
};
```

**Migration path:** Introduce `execute(request)` alongside existing methods; deprecate flat params after async workers adopt the object.

## BYOK and billing responsibility

| Scenario | Whose credits | When |
|----------|---------------|------|
| Active BYOK credential | **You** — billed by your provider (OpenAI, Anthropic, etc.) | Every AI call while your key is active |
| Platform fallback **off** | **You** only | If your provider fails, the request fails — **no server credits** |
| Platform fallback **on** | **You** first; **server** only on fallback | Only after your provider errors/retries fail, and only if you opted in |
| No BYOK row, `OPENAI_API_KEY` on server | **Platform** (server configuration) | When no personal key is configured |

Telemetry records `credential_source`: `user` | `platform` for audit.

**User-facing rule:** Platform-managed credits are never used for BYOK users unless `allow_platform_fallback` is explicitly enabled on the credential.

## BYOK fallback safety (P0)

- BYOK users never silently consume platform API credits
- Platform fallback requires `allow_platform_fallback` on the credential row (default `false`)
- User-owned and platform-managed fallback chains are separate
- Retries/fallback must not double-charge across domains (see P2 idempotency)

## Gateway decomposition (future)

`aiGateway.js` is a temporary orchestrator with extraction-ready sections:

1. Credential Resolution
2. Model Validation
3. Protection / Rate-Limit Hooks
4. Provider Execution
5. Fallback Handling (v1: static order; future: cheapest-first, fastest-first, reliability-first, capability-first)
6. Telemetry (`prompt_version`, `prompt_hash`, `credential_source`)
7. Health Checks

## Provider normalization

Adapters own provider-specific behavior. The gateway never branches on `if (provider === 'anthropic')`.

Adapters normalize:

- Token accounting differences
- JSON / structured output (fences, refusals, empty bodies)
- OpenAI-compatible quirks (OpenRouter, Grok, NVIDIA NIM)
- Anthropic Messages / Gemini generateContent response shapes

See [src/providers/README.md](../src/providers/README.md) for adapter versioning policy.

## Model identifier normalization

All BYOK model strings pass through `src/utils/normalizeModelInput.js` before save, health check, and gateway execution.

| Rule | Detail |
|------|--------|
| Charset | Printable ASCII only: `a-z`, `0-9`, `/`, `-`, `_`, `.`, `:` |
| Casing | Plain `toLowerCase()` after charset validation (canonical form) |
| Validity | Provider APIs (`healthCheck`, `generate*`) — no local prefix lists or whitelists |
| `DEFAULT_MODELS` | UI suggested-model hints only — never silent substitution on save/test/gateway |

Legacy mixed-case rows are re-normalized at gateway/health boundaries (idempotent).

## Provider adapter versioning (P1+)

Upstream APIs change independently. Future patterns:

- `adapterVersion` on each provider export (e.g. `"1.0.0"`) for telemetry/audit
- Versioned folders: `src/providers/openai/v1/`, `v2/`
- Capability snapshots per adapter version

**Rule:** Normalization contract toward the gateway remains backward-compatible even when providers mutate APIs.

## Telemetry (v1 — best-effort)

`llm_usage_logs` inserts are **fire-and-forget** (not awaited on the critical path).

Telemetry must **never**:

- Block AI execution completion
- Fail user-facing flows (apply, parse, setup)
- Become synchronous critical-path infrastructure

### Future retention / operations (documented only)

| Concern | Future approach |
|---------|-----------------|
| Retention | TTL job — delete/archive rows older than N days |
| Archival | Cold storage (S3/Parquet) |
| Partitioning | Monthly partitions on `created_at` |
| Writes | Batched buffer or dedicated telemetry worker |
| Analytics | Read replica or warehouse export |

Schema today: `prompt_version`, `prompt_hash`, `credential_source`. P2: `ai_request_id`, `request_hash`, `adapter_version`.

## Prompt versioning

Export `PROMPT_VERSION` from prompt modules (e.g. `src/prompts/jdParsePrompt.js`) and pass as `promptVersion` to the gateway. Gateway computes `prompt_hash` for reproducibility across retries/fallbacks.

## Async orchestration — scope discipline

**Phase 1 (current):** Provider abstraction, BYOK, execution portability, lightweight telemetry.

**Phase 2 (deferred):** Full `Controller → Queue → Worker → DB Status` for parse/email.

`src/queues/aiJobQueue.js` and `src/workers/aiJob.worker.js` are **architectural preparation only**. Do not add distributed AI queue complexity until the provider layer is stable in production.

Rules:

- Do not merge AI parse queue with SMTP `send-application` queue prematurely
- Future workers call **`aiGateway` only** — never provider SDKs
- Phase 2 starts when: BYOK/fallback validated, provider smoke tests green, telemetry non-blocking under load, `AiExecutionRequest` agreed for worker payloads

## User credential chain (multi-key BYOK)

Users may store multiple provider keys with ordered fallback:

- **Primary** (`priority = 0`) — tried first; enforced by partial unique index `(user_id) WHERE priority = 0`
- **Backups** (`priority = 1+`) — distinct stored keys, tried on retryable failure
- **Paused** (`in_fallback_chain = false`) — kept in Setup, excluded from chain
- **Platform fallback** — only after user chain exhausted, if primary has `allow_platform_fallback`

Priority updates use **temp-offset compaction** (`priority += 10000`, then assign 0..n-1) inside a transaction to avoid unique-index violations during reorder/delete.

### Credential health

| Status | Class | Recovery |
|--------|-------|----------|
| `healthy` | — | default |
| `invalid` | Terminal | user re-test or key update only |
| `rate_limited` | Recoverable | success on same credential |
| `quota_exceeded` | Recoverable | success on same credential |

Classification: `src/services/aiRetryPolicy.js`. Health updates must not auto-clear `invalid` from another credential’s success.

### Execution context and caching

- `createExecutionContext({ userId, reqId, jobId })` — decrypt chain once per HTTP request or job
- Phase 2: shared TTL cache (`ai:creds:{userId}:{chainVersion}`) for workers — see `aiExecutionContext.js`

### Observability events

`AI_CHAIN_RESOLVED`, `AI_CHAIN_ATTEMPT`, `AI_CHAIN_SKIP`, `AI_CHAIN_FALLBACK`, `AI_CHAIN_HEALTH_TRANSITION`, `AI_CHAIN_EXHAUSTED` — include `credentialId`, `fallbackIndex`, `skipReason`, canonical lowercase `model`.

Model-specific events (always use canonical lowercase `model`):

| Event | When |
|-------|------|
| `AI_MODEL_HEALTH_CHECK` | Adapter health probe started |
| `AI_MODEL_EXECUTION` | Gateway attempt before provider call |
| `AI_MODEL_PROVIDER_ERROR` | Classified provider failure |
| `AI_MODEL_INVALID` | Provider rejected model id (404 / model-not-found) |

## P2 roadmap

- Idempotency: `ai_request_id`, request hashing
- Provider capability integration test matrix — see `tests/providers/README.md`
- Full async migration via `aiJobQueue` / `aiJob.worker`
- Redis-backed credential chain cache for multi-instance workers
