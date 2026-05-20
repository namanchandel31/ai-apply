# UI status resolution

API exposes both `status` (business enum) and `uiStatus` (derived for dashboards).

`resolveUiStatus(ctx)` runs a pure rule pipeline (first match wins):

1. Terminal — `sent`, `cancelled`
2. Review — `needs_review` + `review_reason`
3. Failed — `failed`
4. Retry — active job in `retrying`
5. Sending — active `send_email` job
6. Processing — active `ai_process` job
7. Generated — idle after AI
8. Draft — fallback

Context is built via `buildResolverContext()` from application row + latest jobs.

Capabilities (`pollable`, `canRetry`, `canContinue`, `terminal`) are attached per resolved `uiStatus`.

## `terminal` vs workflow complete

- **`terminal: true`** — automated execution lifecycle is fully complete (no further worker automation). Examples: `sent`, `failed`, `cancelled` (UI).
- **`terminal: false`** — workflow may still continue. Example: **`needs_review`** uses `pollable: false` (stop polling) but `terminal: false` (human can continue).
- Do not confuse `terminal` with “business workflow closed” — use `application_status` for business state.
- API may expose `executionTerminal` as an alias mirroring `terminal` (non-breaking).

Frontend polling should use **`pollable`** and **`terminal`** from the API, not hardcoded status strings.

See `src/domain/applicationStatus/resolver/resolveUiStatus.js` and `resolveCapabilities.js`.

## Dual `failed` semantics

The string `failed` appears on two layers with **different meanings**:

| Layer | Field | Meaning |
|-------|--------|---------|
| Business | `applications.application_status = failed` | Workflow reached business failure (automation stops; user may retry to open a new execution) |
| Execution | `application_jobs.status = failed` | This **attempt** failed; row is append-only history |

They are not equivalent:

- A **failed job row** can coexist with `application_status` of `draft` or `generated` after the user retries (new job row is created).
- `application_status = failed` drives UI `canRetry` and terminal automation behavior.
- Job `failed` does not alone mean the workflow is permanently closed.

Helpers: `src/domain/applicationStatus/failureSemantics.js` (`isWorkflowFailed`, `isExecutionAttemptFailed`).

Lineage for retries: `application_events.metadata` (`attemptNumber`, `previousJobId`, `retrySource`).
