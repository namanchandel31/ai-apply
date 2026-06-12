const { bool, int, csv, str } = require("./env");

const CERTIFICATION_ATTEMPT_COUNT = 2;

function isCertificationEnabled() {
  return (
    bool("MODEL_CERTIFICATION_ENABLED", false) ||
    bool("MODEL_BENCHMARK_ENABLED", false)
  );
}

function getAdminEmails() {
  const primary = csv("MODEL_CERTIFICATION_ADMIN_EMAILS");
  if (primary.length) return primary;
  return csv("MODEL_BENCHMARK_ADMIN_EMAILS");
}

module.exports = {
  CERTIFICATION_ATTEMPT_COUNT,
  enabled: isCertificationEnabled(),
  adminEmails: getAdminEmails(),
  valueNormDivisor: int("MODEL_CERT_VALUE_NORM_DIVISOR", 30000),
  passThreshold: int("MODEL_CERTIFICATION_PASS_THRESHOLD", 80),
  recommendThreshold: int("MODEL_CERTIFICATION_RECOMMEND_THRESHOLD", 90),
  runTimeoutMs: int("MODEL_CERTIFICATION_TIMEOUT_MS", 360000),
  isEnabled: isCertificationEnabled,
  getAdminEmails,
};
