const { z } = require("zod");
const { PARSE_OUTCOMES } = require("./parseOutcomes");

/** LLM-facing schema (provider output before enrichment). */
const JdLlmOutputSchema = z.object({
  job_title: z.string().nullable().optional(),
  roles: z.array(z.string()).optional().default([]),
  company_name: z.string().nullable().optional(),
  contact_person: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  contact_email: z.string().nullable().optional(),
  contact_number: z.string().nullable().optional(),
  job_type: z.enum(["Remote", "Hybrid", "Onsite", "Unknown"]).nullable().optional(),
  skills: z.array(z.string()).optional().default([]),
});

const ParseOutcomeSchema = z.enum([
  PARSE_OUTCOMES.SUCCESS,
  PARSE_OUTCOMES.PARTIAL_SUCCESS,
  PARSE_OUTCOMES.LOW_CONFIDENCE,
  PARSE_OUTCOMES.AMBIGUOUS_MULTI_ROLE,
  PARSE_OUTCOMES.SPAM_DETECTED,
  PARSE_OUTCOMES.UNSUPPORTED_FORMAT,
  PARSE_OUTCOMES.GARBAGE_INPUT,
]);

const ReviewHintsSchema = z
  .object({
    needsReview: z.boolean(),
    reviewReason: z.string().nullable().optional(),
    candidateRoles: z.array(z.string()).optional().default([]),
  })
  .optional();

const ParseArtifactsSchema = z
  .object({
    promptVersion: z.string().optional(),
    provider: z.object({ name: z.string().optional(), model: z.string().optional() }).optional(),
    rawLlmResponse: z.record(z.unknown()).optional(),
    heuristicExtraction: z.record(z.unknown()).optional(),
    enrichedOutput: z.record(z.unknown()).optional(),
    selection: z.record(z.unknown()).optional(),
    confidence: z.record(z.unknown()).optional(),
    timings: z.record(z.number()).optional(),
    createdAt: z.string().optional(),
  })
  .optional();

/** Enriched contract persisted on parsed_json. */
const JdEnrichedSchema = JdLlmOutputSchema.extend({
  parseOutcome: ParseOutcomeSchema.optional(),
  parseConfidence: z.number().min(0).max(1).optional(),
  parseArtifacts: ParseArtifactsSchema,
  reviewHints: ReviewHintsSchema,
});

/**
 * @param {unknown} payload
 * @returns {z.infer<typeof JdLlmOutputSchema>}
 */
function createEmptyLlmContract() {
  return {
    job_title: null,
    roles: [],
    company_name: null,
    contact_person: null,
    location: null,
    contact_email: null,
    contact_number: null,
    job_type: null,
    skills: [],
  };
}

module.exports = {
  JdLlmOutputSchema,
  JdEnrichedSchema,
  ParseOutcomeSchema,
  ReviewHintsSchema,
  ParseArtifactsSchema,
  createEmptyLlmContract,
};
