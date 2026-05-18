# Provider Capability Test Matrix (P2)

Future integration verification per **provider × model** combination.

## Dimensions

| Dimension | Verify |
|-----------|--------|
| Structured JSON | Valid `parsed` for resume/JD/email fixtures |
| Token usage | Consistent `usage` normalization |
| Retry behavior | Transient vs permanent error mapping |
| Timeout | Abort within configured `timeoutMs` |
| OpenAI-compatible | OpenRouter, Grok, NVIDIA quirks |
| Anthropic / Gemini | Response normalization |

## Strategy

- Unit tests: mock HTTP/SDK per adapter
- Recorded fixtures (VCR) for regression
- Nightly or manual matrix with sandbox API keys
- Business tests mock `aiGateway` only

## CI (v1)

Smoke tests with mocked providers only — no live API keys.
