const { int } = require("./env");

const DEFAULT_MIN_DELAY_SECONDS = 30;
const DEFAULT_MAX_DELAY_SECONDS = 150;

const minDelaySeconds = int(
  "INTELLIGENT_SEND_QUEUE_MIN_DELAY_SECONDS",
  DEFAULT_MIN_DELAY_SECONDS
);
const maxDelaySeconds = int(
  "INTELLIGENT_SEND_QUEUE_MAX_DELAY_SECONDS",
  DEFAULT_MAX_DELAY_SECONDS
);

function validateIntelligentSendQueueConfig() {
  const min =
    Number.isFinite(minDelaySeconds) && minDelaySeconds >= 0
      ? minDelaySeconds
      : DEFAULT_MIN_DELAY_SECONDS;
  const max =
    Number.isFinite(maxDelaySeconds) && maxDelaySeconds >= min
      ? maxDelaySeconds
      : DEFAULT_MAX_DELAY_SECONDS;
  return { minDelaySeconds: min, maxDelaySeconds: max };
}

const validated = validateIntelligentSendQueueConfig();

module.exports = {
  minDelaySeconds: validated.minDelaySeconds,
  maxDelaySeconds: validated.maxDelaySeconds,
  DEFAULT_MIN_DELAY_SECONDS,
  DEFAULT_MAX_DELAY_SECONDS,
  validateIntelligentSendQueueConfig,
};
