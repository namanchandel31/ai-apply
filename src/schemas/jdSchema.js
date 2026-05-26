const { z } = require("zod");
const { JdLlmOutputSchema, JdEnrichedSchema } = require("../domain/jd/jdParseContract");

/**
 * @deprecated Use JdLlmOutputSchema — kept for backward-compatible imports.
 */
const JDSchema = JdLlmOutputSchema;

module.exports = { JDSchema, JdLlmOutputSchema, JdEnrichedSchema };
