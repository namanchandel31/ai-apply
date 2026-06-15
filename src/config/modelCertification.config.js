const { int } = require("./env");

// Admin access to model certification is gated by the users.is_admin DB flag
// (see middlewares/adminGuard.js), so the legacy enable/allowlist env config
// has been removed. Remaining values are runtime tuning for the cert pipeline.
const CERTIFICATION_ATTEMPT_COUNT = 2;

module.exports = {
  CERTIFICATION_ATTEMPT_COUNT,
  valueNormDivisor: int("MODEL_CERT_VALUE_NORM_DIVISOR", 30000),
  passThreshold: int("MODEL_CERTIFICATION_PASS_THRESHOLD", 80),
  recommendThreshold: int("MODEL_CERTIFICATION_RECOMMEND_THRESHOLD", 90),
  runTimeoutMs: int("MODEL_CERTIFICATION_TIMEOUT_MS", 360000),
};
