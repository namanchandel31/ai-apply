/** @typedef {import('./jdParseContract').ParseOutcome} ParseOutcome */

const PARSE_OUTCOMES = Object.freeze({
  SUCCESS: "success",
  PARTIAL_SUCCESS: "partial_success",
  LOW_CONFIDENCE: "low_confidence",
  AMBIGUOUS_MULTI_ROLE: "ambiguous_multi_role",
  SPAM_DETECTED: "spam_detected",
  UNSUPPORTED_FORMAT: "unsupported_format",
  GARBAGE_INPUT: "garbage_input",
});

const APPLY_ELIGIBLE_OUTCOMES = new Set([
  PARSE_OUTCOMES.SUCCESS,
  PARSE_OUTCOMES.PARTIAL_SUCCESS,
  PARSE_OUTCOMES.LOW_CONFIDENCE,
  PARSE_OUTCOMES.AMBIGUOUS_MULTI_ROLE,
]);

const FAILURE_OUTCOMES = new Set([
  PARSE_OUTCOMES.SPAM_DETECTED,
  PARSE_OUTCOMES.UNSUPPORTED_FORMAT,
  PARSE_OUTCOMES.GARBAGE_INPUT,
]);

function isApplyEligible(outcome) {
  return APPLY_ELIGIBLE_OUTCOMES.has(outcome);
}

function isFailureOutcome(outcome) {
  return FAILURE_OUTCOMES.has(outcome);
}

module.exports = {
  PARSE_OUTCOMES,
  APPLY_ELIGIBLE_OUTCOMES,
  FAILURE_OUTCOMES,
  isApplyEligible,
  isFailureOutcome,
};
