# Prompts and parsing

[`jobHandler.js`](../../src/services/jobHandler.js) — PDF text extraction + structured JSON via LLM.

## Outputs

| Stage | Storage |
|-------|---------|
| Resume parse | `parsed_resumes.parsed_json` |
| JD parse | `parsed_job_descriptions` + denormalized `job_descriptions` fields |
| Email | `applications.email_subject`, `email_body` |

## Validation

Zod/validators on parsed shapes; invalid emails nulled.

## Sanitization

[`textSanitize.js`](../../src/utils/textSanitize.js) — protect emails/URLs during normalization.

## Related Documentation

- [../workers/process-worker.md](../workers/process-worker.md)
