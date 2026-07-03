/**
 * Rule priority (first match wins):
 * 1. terminal — sent/cancelled override stale jobs
 * 2. review — human pause before automation display
 * 3. failed — terminal failure before retry spinner
 * 4. retry — active retry jobs
 * 5. queued_sending — intelligent send queue waiting
 * 6. sending — outbound email in flight
 * 7. processing — AI pipeline in flight
 * 7. generated — idle after AI
 * 8. draft — fallback
 */
const resolveTerminalState = require("./resolveTerminalState");
const resolveReviewState = require("./resolveReviewState");
const resolveFailedState = require("./resolveFailedState");
const resolveRetryState = require("./resolveRetryState");
const resolveQueuedSendingState = require("./resolveQueuedSendingState");
const resolveSendingState = require("./resolveSendingState");
const resolveProcessingState = require("./resolveProcessingState");
const resolveGeneratedState = require("./resolveGeneratedState");
const resolveDraftState = require("./resolveDraftState");

const RULES = [
  { name: "resolveTerminalState", run: resolveTerminalState },
  { name: "resolveReviewState", run: resolveReviewState },
  { name: "resolveFailedState", run: resolveFailedState },
  { name: "resolveRetryState", run: resolveRetryState },
  { name: "resolveQueuedSendingState", run: resolveQueuedSendingState },
  { name: "resolveSendingState", run: resolveSendingState },
  { name: "resolveProcessingState", run: resolveProcessingState },
  { name: "resolveGeneratedState", run: resolveGeneratedState },
  { name: "resolveDraftState", run: resolveDraftState },
];

module.exports = { RULES };
