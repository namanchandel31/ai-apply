# Glossary

Domain terms aligned with codebase naming. Use these consistently in PRs, logs, and docs.

## Core entities

| Term | Meaning | Storage / code |
|------|---------|----------------|
| **application** | A single job-application workflow for one user, resume, and JD | `applications` table; `applicationModel.js` |
| **job** (application job) | One execution attempt for AI processing or email send | `application_jobs`; not BullMQ job alone |
| **event** | Immutable audit record of something that happened | `application_events` (append-only) |
| **uiStatus** | Derived presentation status for dashboards | `resolveUiStatus()` — **never persisted** |

## State layers

| Term | Layer | Notes |
|------|-------|-------|
| **business lifecycle** | `applications.application_status` | `draft`, `generated`, `needs_review`, `sent`, `failed`, `cancelled` |
| **execution lifecycle** | `application_jobs.status` | `queued`, `processing`, `retrying`, `completed`, `failed` |
| **business truth** | Application row | What the product considers “where we are” |
| **execution truth** | Latest/relevant job rows | What workers are doing right now |
| **audit truth** | Events | History; not used to drive automation |
| **derived truth** | `uiStatus` + capabilities | Built from business + jobs |

## Status values

| Term | Meaning |
|------|---------|
| **draft** | Application created; AI pipeline not finished |
| **generated** | Email drafted; eligible to send |
| **needs_review** | Missing/invalid contact email; human must continue |
| **sent** | SMTP succeeded; terminal business state |
| **failed** (application) | Business workflow failed; automation stopped |
| **failed** (job) | **This attempt** failed; historical row unchanged on retry |
| **processing** | Active worker owns `ai_process` or send in flight |
| **sending** | uiStatus when active `send_email` job exists |
| **retrying** | Job row in recovery/retry state |

## Operations

| Term | Meaning |
|------|---------|
| **CAS** | Compare-and-swap update (e.g. `generated` → `sent`) | `transitionApplicationState`, `markSentFromGenerated` |
| **retry** | User or system re-attempt after failure | New `application_jobs` row; may bump `application_status` |
| **recovery** | Scheduled job re-enqueues stuck work | `recovery.job.js` |
| **reconciliation** | Client rejects stale SSE/poll updates | `shouldApplyEvent`, version/epoch checks |
| **idempotency** | Safe duplicate enqueue/API calls | Deterministic BullMQ IDs; idempotency headers |

## Realtime & orchestration

| Term | Meaning |
|------|---------|
| **orchestration** | Client-side registry of active applications + version sync | `orchestrationRegistry`, `/api/orchestration/active` |
| **orchestration_version** | Monotonic counter per application for event ordering | `applications.orchestration_version` |
| **orchestration_epoch** | Bumped on revive/invalidate | `applications.orchestration_epoch` |
| **pollable** | API says client should poll status | From `resolveCapabilities` |
| **terminal** | No further automated execution (may still allow human continue) | Not identical to “business closed” |
| **SSE** | Server-Sent Events stream | `/api/realtime/stream` |
| **leader tab** | Browser tab that owns SSE connection | `orchestrationTabLeader` |

## Infrastructure

| Term | Meaning |
|------|---------|
| **worker** | Node process consuming BullMQ queues | `src/workers/` |
| **inline workers** | Workers started inside API process (dev only) | `queue.config.shouldRunInlineWorkers()` |
| **queue** | BullMQ Redis queue | `process-application`, `send-application` |
| **deterministic job ID** | `process:application:{id}`, `send:application:{id}` | Prevents duplicate active jobs |

## AI

| Term | Meaning |
|------|---------|
| **BYOK** | User brings own API key | `user_ai_credentials` |
| **platform fallback** | System `OPENAI_API_KEY` when user has no key | `aiGateway.js` |
| **ai_process** | DB job type for JD parse + match + email generation | Maps to `process-application` queue |
| **send_email** | DB job type for SMTP send | Maps to `send-application` queue |

## Related Documentation

- [architecture/state-model.md](architecture/state-model.md)
- [architecture/system-invariants.md](architecture/system-invariants.md)
- [development/conventions.md](development/conventions.md)
