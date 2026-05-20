# Application lifecycle

## Business status (`applications.application_status`)

| Status | Meaning |
|--------|---------|
| `draft` | Record created; AI processing not finished |
| `generated` | Email drafted; eligible for send |
| `needs_review` | Human must supply/fix contact email (`review_reason` set) |
| `sent` | SMTP delivered successfully |
| `failed` | Business workflow failure (automation stopped; distinct from a single failed job attempt) |
| `cancelled` | User cancelled before send |

Execution progress lives in `application_jobs`, not on the application row.

## Job status (`application_jobs.status`)

`queued` → `processing` → `completed` | `failed` (with `retrying` for recovery).

Job `failed` means **this execution attempt** failed. Historical job rows are not updated on retry; a new `application_jobs` row is inserted. See `docs/UI_STATUS_RESOLUTION.md` (dual failed semantics).

## Recovery indexes

Migration `012_recovery_indexes.sql` adds partial indexes for latest-active recovery queries (`queued` / `processing` filters). Base index `idx_app_jobs_application (application_id, created_at DESC)` from 011b supports latest-per-type grouping.

## Flow

1. `POST /api/auto-apply` — insert JD placeholder, application `draft`, `ai_process` job, enqueue `process:application:{id}` (HTTP returns **202**).
2. Process worker — parse JD, match, generate email → `generated` or `needs_review`.
3. If `generated` with contact email — enqueue `send:application:{id}`.
4. Send worker — SMTP → CAS `generated` → `sent`.

## Commands

- `POST /api/applications/:id/continue` — `needs_review` → `generated`, then enqueue send.
- `POST /api/applications/:id/retry` — re-run AI (`failed` → `draft`) or re-enqueue send (`generated`).
- `POST /api/applications/:id/cancel` — terminal `cancelled`.
