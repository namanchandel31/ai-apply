# JD Parser Metrics Dashboard

The JD ingestion pipeline emits orchestration metrics via `orchestrationMetrics`.

## Counters

| Metric | Tags | Meaning |
|--------|------|---------|
| `orchestration.jd_parse.outcome` | `outcome` | Parse result category (success, partial_success, low_confidence, etc.) |
| `orchestration.jd_parse.failure` | `retryable`, `outcome` | Hard failures and errors |
| `orchestration.jd_parse.success` | `outcome` | Apply-eligible parses |
| `orchestration.jd_parse.validation_failure` | `field` | Missing/invalid field after enrichment |
| `orchestration.jd_parse.schema_failure` | `provider` | Provider JSON/schema mismatch (retryable) |
| `orchestration.jd_parse.fallback` | `titleSource` | Title inferred outside explicit LLM field |
| `orchestration.jd_parse.heuristic_used` | `used` | Hiring-section / heuristic extraction contributed |

## Histograms

| Metric | Tags | Meaning |
|--------|------|---------|
| `orchestration.jd_parse.confidence` | — | Final parse confidence score (0–1) |
| `orchestration.jd_parse.duration_ms` | `phase=llm\|enrich` | Latency by pipeline phase |

## Example log queries

- Enriched parses: `JD_PARSE_ENRICHED`
- Failures: `JD_PARSE_FAILED`, `JD_PARSE_INVALID_CONTENT`
- Terminal failures: `JOB_TERMINAL_FAILURE` with `willRetry: false` (non-retryable / UnrecoverableError)
- Queue-only completion: `JOB_QUEUE_COMPLETED` when worker skips already-terminal application (not business success)
- Worker retries: `JOB_RETRIED` only when `willRetry: true` (retryable errors only)

## Health checks

- **Parse success rate**: `outcome=success|partial_success` / total outcomes
- **Fallback rate**: `jd_parse.fallback` / total parses
- **Low confidence rate**: `outcome=low_confidence` / total
- **Provider failures**: `JD_PARSE_FAILED` grouped by `failure_class`

## Golden regression

Run before rollout:

```bash
npm test -- tests/jdParseRegression.unit.test.js
```

Fixtures live in `tests/fixtures/jd-golden/`. Update `baseline.json` only when intentionally changing parser behavior.
