# AI Resume Parsing Failure Logbook

## Session Info

| Field          | Value                     |
| -------------- | ------------------------- |
| Feature        | Resume Upload + Parsing   |
| Endpoint       | `POST /api/upload-resume` |
| Environment    | Local                     |
| Date           | 2026-05-18                |
| Current Status | Unstable                  |
| Severity       | High                      |

---

# 1. PIPELINE STATUS

| Stage                    | Status     | Notes                             |
| ------------------------ | ---------- | --------------------------------- |
| File Upload              | ✅ Working  | Multipart upload succeeds         |
| Hash Generation          | ✅ Working  | Duplicate detection works         |
| Supabase Storage Upload  | ✅ Working  | Upload success logged             |
| DB Reconciliation        | ✅ Working  | Metadata reconciliation succeeds  |
| PDF Extraction           | ✅ Working  | Text extracted successfully       |
| Text Sanitization        | ✅ Working  | Sanitized text generated          |
| Resume Preparation       | ✅ Working  | Parsing payload prepared          |
| LLM Parsing              | ❌ Unstable | Provider timeout / 429            |
| Retry Lifecycle          | ❌ Broken   | Request lifecycle cancels retries |
| Telemetry Logging        | ❌ Broken   | DB constraint failures            |
| Failed Parse Persistence | ❌ Broken   | DB connectivity failures          |
| HTTP Lifecycle           | ❌ Blocking | 20–90 sec synchronous requests    |

---

# 2. ACTIVE FAILURES

---

## ISSUE-001 — Free Provider Timeout

### Symptoms

```txt
RetryableError: request_timeout
Request aborted: This operation was aborted
504 Gateway Timeout
```

### Root Cause

* Slow/free models
* HTTP lifecycle owns AI lifecycle
* Shared AbortController likely cancels retries

### Affected Models

* `nvidia/nemotron-3-super-120b-a12b:free`

### Priority

🔴 Critical

### Fix Checklist

* [ ] Replace free Nemotron model
* [ ] Add provider timeout
* [ ] Separate provider timeout from controller timeout
* [ ] Ensure retries use isolated AbortControllers

---

## ISSUE-002 — Provider Rate Limiting

### Symptoms

```txt
429 Provider returned error
```

### Root Cause

* Free OpenRouter model
* No fallback provider chain
* Retries hitting same provider repeatedly

### Affected Models

* `deepseek/deepseek-v4-flash:free`

### Priority

🔴 Critical

### Fix Checklist

* [ ] Remove dependency on free-tier models
* [ ] Add multi-provider fallback chain
* [ ] Add provider cooldown logic
* [ ] Add retry jitter/backoff

---

## ISSUE-003 — Retry Boundary Architecture

### Symptoms

Retries trigger:

* credential lookup
* DB queries
* telemetry
* provider resolution

### Root Cause

Retry scope too large.

### Current Anti-Pattern

```txt
retry(all infrastructure + provider execution)
```

### Desired Pattern

```txt
resolve infra once
retry only provider execution
```

### Priority

🔴 Critical

### Fix Checklist

* [ ] Resolve credential chain once
* [ ] Cache provider context per request
* [ ] Retry only provider call
* [ ] Move telemetry outside retry scope

---

## ISSUE-004 — Shared Abort Lifecycle

### Symptoms

```txt
Request cancelled during retry backoff
```

### Root Cause

Likely shared AbortController reused across retries.

### Priority

🔴 Critical

### Fix Checklist

* [ ] Create fresh AbortController per retry attempt
* [ ] Decouple HTTP socket abort from retry lifecycle
* [ ] Ensure retry backoff survives controller timeout

---

## ISSUE-005 — Telemetry Failure Cascade

### Symptoms

```txt
null value in column "provider"
of relation "llm_usage_logs"
violates not-null constraint
```

### Root Cause

Telemetry pipeline lacks defensive handling.

### Impact

Observability itself causes failures.

### Priority

🟠 High

### Fix Checklist

* [ ] Make telemetry fire-and-forget
* [ ] Wrap telemetry writes in try/catch
* [ ] Ensure provider field never null
* [ ] Add telemetry validation

---

## ISSUE-006 — DB Connection Instability

### Symptoms

```txt
read ECONNRESET
getaddrinfo ENOTFOUND
```

### Root Cause Candidates

* Pool instability
* DNS resolution issue
* Supabase connectivity
* Windows IPv6 issue
* Pool exhaustion

### Priority

🔴 Critical

### Fix Checklist

* [ ] Verify DB pool config
* [ ] Add keepAlive
* [ ] Add idle timeout
* [ ] Add connection timeout
* [ ] Test IPv4-only connection
* [ ] Verify Supabase hostname resolution
* [ ] Check max pool connections

---

## ISSUE-007 — Failure Recovery Failure

### Symptoms

```txt
fallback_storage_failed
```

### Root Cause

Failure persistence depends on unstable DB connection.

### Impact

System cannot preserve failed parsing state.

### Priority

🟠 High

### Fix Checklist

* [ ] Add local disk fallback
* [ ] Add queue-based failure persistence
* [ ] Make failed parse storage non-blocking
* [ ] Retry fallback persistence independently

---

## ISSUE-008 — Synchronous AI Architecture

### Symptoms

```txt
responseTime: 90174
```

### Root Cause

AI processing tied to HTTP request lifecycle.

### Impact

* Long request blocking
* Poor scalability
* Controller instability
* Retry cancellation

### Priority

🔴 Critical

### Fix Checklist

* [ ] Move parsing to BullMQ worker
* [ ] Return 202 immediately
* [ ] Add polling endpoint
* [ ] Add job lifecycle states
* [ ] Add worker retry management

---

## ISSUE-009 — Encoding Corruption

### Symptoms

```txt
ΓÇó
ΓÇô
├»
```

### Root Cause

PDF extraction encoding normalization issue.

### Priority

🟡 Medium

### Fix Checklist

* [ ] Add encoding cleanup layer
* [ ] Normalize UTF-8 conversion
* [ ] Add PDF sanitization utility
* [ ] Add extracted-text quality validation

---

# 3. RECOMMENDED MODEL STACK

## Primary

```txt
google/gemini-2.0-flash
```

## Secondary

```txt
openai/gpt-4o-mini
```

## Tertiary

```txt
claude-3-haiku
```

---

# 4. REQUIRED ARCHITECTURAL CHANGES

---

## Immediate

* [ ] Remove free models
* [ ] Fix retry boundary
* [ ] Fix AbortController lifecycle
* [ ] Harden telemetry
* [ ] Stabilize DB pool

---

## Short-Term

* [ ] Provider fallback chain
* [ ] Circuit breaker improvements
* [ ] Provider cooldowns
* [ ] Better retry classification
* [ ] Provider health tracking

---

## Mid-Term

* [ ] BullMQ async workers
* [ ] Queue separation
* [ ] Job persistence
* [ ] Frontend polling
* [ ] Realtime status updates

---

## Long-Term

* [ ] Multi-stage AI workflows
* [ ] Distributed workers
* [ ] Queue prioritization
* [ ] AI orchestration layer
* [ ] Cost optimization engine

---

# 5. CURRENT SYSTEM RATING

| Category             | Score  |
| -------------------- | ------ |
| Logging              | 8/10   |
| Observability        | 7/10   |
| Upload Pipeline      | 8.5/10 |
| AI Reliability       | 3/10   |
| Retry Design         | 4/10   |
| Failure Isolation    | 2/10   |
| Infra Stability      | 5/10   |
| Production Readiness | 4.5/10 |

---

# 6. FINAL DIAGNOSIS

Current system state:

```txt
Advanced AI prototype
```

Not yet:

```txt
Production-grade resilient AI platform
```

Main architectural weakness:

```txt
Everything can fail everything else.
```

Goal state:

```txt
Failure isolation + async AI workers + provider redundancy
```
