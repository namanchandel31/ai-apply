# Email generation metadata (Phase 1)

## Storage

| Column | Type | Purpose |
|--------|------|---------|
| `applications.email_metadata` | JSONB | Latest generation run quality snapshot |
| `applications.email_feedback_signals` | JSONB | Future recruiter/user engagement hooks |

## `email_metadata` shape (`schemaVersion: 1`)

```json
{
  "schemaVersion": 1,
  "latestRun": {
    "promptVersion": "email_generate_v2",
    "model": "string",
    "generationTimeMs": 0,
    "retryCount": 0,
    "toneType": "startup_concise_remote_first",
    "personalizationUsed": ["recruiterName"],
    "wordCount": 165,
    "validationSignals": { "bannedPhraseScore": 0, "aiPunctuationScore": 0 },
    "hardFailures": [],
    "compositeRisk": 25,
    "scores": {
      "realism": {},
      "recruiterReadability": {},
      "openingStrength": {},
      "diversity": {}
    },
    "recruiterComposite": 72,
    "critiqueSummary": null,
    "rewriteGuidanceApplied": false
  },
  "history": [
    { "attempt": "initial", "recruiterComposite": 65, "compositeRisk": 55 },
    { "attempt": "retry", "recruiterComposite": 72, "compositeRisk": 30 }
  ]
}
```

## `email_feedback_signals` (nullable hooks)

All fields default to `null` until future features populate them:

- `manuallyEdited`
- `recruiterReply`
- `ignored`
- `bounced`
- `regenerated`
- `userRewritten`
- `responseLatencyMs`

Updater stub: `recordEmailFeedback(applicationId, partialSignals, userId?)` in `src/services/emailFeedbackService.js`.

## Phase 2 (documented, not migrated)

When analytics volume requires normalization:

```sql
-- email_generation_runs (per attempt: initial + retry)
-- email_validation_results (signals + hard failures per run)
-- email_feedback_events (time-series engagement)
```

Phase 1 namespaced JSONB is designed for a straight explode into these tables without rewriting generation logic.
