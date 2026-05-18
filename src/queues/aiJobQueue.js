/**
 * AI Job Queue — ARCHITECTURAL PREPARATION ONLY (Phase 2 deferred)
 *
 * Phase 1 focus: provider abstraction + aiGateway execution portability + BYOK.
 * Do NOT introduce BullMQ AI queues, Redis workers, or distributed complexity until
 * the provider layer is operationally stable in production.
 *
 * Target flow (Phase 2): Controller → Queue → Worker → DB Status
 *   enqueueAiJob({ type, userId, payload, reqId })
 *   Types: RESUME_PARSE | JD_PARSE | EMAIL_GENERATE
 *
 * Workers must call aiGateway only — never provider SDKs.
 * Keep separate from SMTP send-application queue — do not merge prematurely.
 *
 * Phase 2 trigger criteria (see docs/AI_GATEWAY.md):
 *   - BYOK + fallback policy validated in production
 *   - Provider matrix smoke tests green
 *   - Telemetry non-blocking under load
 *   - AiExecutionRequest shape agreed for worker payloads
 */

async function enqueueAiJob(_payload) {
  throw new Error("AI_JOB_QUEUE_NOT_IMPLEMENTED: synchronous gateway path is used in v1");
}

module.exports = { enqueueAiJob };
