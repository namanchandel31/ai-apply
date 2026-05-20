# BYOK and platform fallback

Users store encrypted keys in `user_ai_credentials`. Platform uses `OPENAI_API_KEY` when allowed.

## Chain

- Priority ordering (`reorderChain` API)
- Health status per credential: healthy, invalid, rate_limited, quota_exceeded
- `allow_platform_fallback` per credential

## API

See [../api/ai-credentials.md](../api/ai-credentials.md).

## Cost tracking

`llm_usage_logs` — tokens, estimated cost, `req_id`.

## Related Documentation

- [gateway-and-providers.md](gateway-and-providers.md)
