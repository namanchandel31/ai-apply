/**
 * AI Job Worker — ARCHITECTURAL PREPARATION ONLY (Phase 2 deferred)
 *
 * Phase 1: All parse/email AI runs synchronously through aiGateway in HTTP handlers.
 * Do not deploy this worker or add BullMQ consumers until Phase 2 begins.
 *
 * Future processor pattern:
 *   1. Claim job from ai_jobs table / BullMQ
 *   2. Call aiGateway.generateStructuredJson({ userId, task, ... })  // or execute(AiExecutionRequest)
 *   3. Update job status + result_ref in DB
 *
 * HARD RULE: Do not import provider SDKs here — aiGateway only.
 *
 * See docs/AI_GATEWAY.md — Async orchestration scope discipline.
 */

// const { Worker } = require("bullmq");
// const { generateStructuredJson } = require("../services/aiGateway");

module.exports = {};
