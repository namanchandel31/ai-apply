# Prompts and parsing

[`jobHandler.js`](../../src/services/jobHandler.js) — PDF text extraction + structured JSON via LLM.

## Outputs

| Stage | Storage |
|-------|---------|
| Resume parse | `parsed_resumes.parsed_json` |
| JD parse | `parsed_job_descriptions` + denormalized `job_descriptions` fields |
| Email | `applications.email_subject`, `email_body`, `email_metadata`, `email_feedback_signals` |

## Email generation (v2)

Pipeline in `src/services/emailService.js`:

1. Build context (`emailContextBuilder.js`) with JD, resume, match, tone, personalization
2. LLM generation (`email_generate_v2` prompt)
3. Weighted validation + recruiter/opening/realism/diversity scoring
4. Optional one targeted critique-retry (section-preserving)
5. Sanitize plain text → persist

See [email-generation-metadata.md](./email-generation-metadata.md) for JSONB schema and Phase 2 table plan.

## Validation

Zod/validators on parsed shapes; invalid emails nulled.

## Sanitization

[`textSanitize.js`](../../src/utils/textSanitize.js) — protect emails/URLs during normalization.

## Related Documentation

- [../workers/process-worker.md](../workers/process-worker.md)
