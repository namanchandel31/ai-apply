/**
 * Central PostgreSQL / infra error classification.
 * Used by process lifecycle, retry, and logging — avoid scattered string matching.
 */

const NETWORK_CODES = new Set([
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ECONNABORTED",
]);

const TRANSIENT_PG_SQLSTATES = new Set(["08006", "57P01", "57P02", "53300"]);

const NON_RETRYABLE_SQLSTATES = new Set([
  "23505", // unique_violation
  "23503", // foreign_key_violation
  "23502", // not_null_violation
  "42601", // syntax_error
  "42P01", // undefined_table
]);

const TRANSIENT_MESSAGE_FRAGMENTS = [
  "connection terminated unexpectedly",
  "connection ended unexpectedly",
  "server closed the connection unexpectedly",
  "client has encountered a connection error",
  "connection terminated due to connection timeout",
];

const FATAL_APP_ERROR_NAMES = new Set(["TypeError", "ReferenceError"]);

/** @type {Map<string, number>} */
const infraLogDedupe = new Map();
const INFRA_LOG_DEDUPE_MS = 5000;

function messageLower(err) {
  return String(err?.message || "").toLowerCase();
}

function messageMatchesFragments(msg) {
  return TRANSIENT_MESSAGE_FRAGMENTS.some((frag) => msg.includes(frag));
}

function isNetworkError(err) {
  if (!err) return false;
  if (NETWORK_CODES.has(err.code)) return true;
  if (err.name === "AbortError" || err.code === "ABORT_ERR" || err.code === 20) {
    return true;
  }
  const msg = messageLower(err);
  return (
    msg.includes("econnreset") ||
    msg.includes("epipe") ||
    msg.includes("etimedout") ||
    msg.includes("econnrefused") ||
    msg.includes("aborted") ||
    msg.includes("aborterror")
  );
}

function isTransientPgError(err) {
  if (!err) return false;
  if (isNetworkError(err)) return true;
  const code = err.code;
  if (TRANSIENT_PG_SQLSTATES.has(code)) return true;
  if (["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EPIPE"].includes(code)) return true;
  return messageMatchesFragments(messageLower(err));
}

function isRecoverableInfraError(err) {
  return isNetworkError(err) || isTransientPgError(err);
}

function isNonRetryablePgError(err) {
  if (!err) return false;
  if (NON_RETRYABLE_SQLSTATES.has(err.code)) return true;
  const msg = messageLower(err);
  if (msg.includes("syntax error") || msg.includes("violates")) return true;
  if (err.code === "STATE_TRANSITION_CONFLICT") return true;
  return false;
}

function isFatalApplicationError(err) {
  if (!err) return false;
  if (isRecoverableInfraError(err)) return false;
  if (FATAL_APP_ERROR_NAMES.has(err.name)) return true;
  if (err.code === "FATAL_INVARIANT" || err.code === "FATAL_APPLICATION") return true;
  if (err.name === "AssertionError") return true;
  return false;
}

function isFatalBootstrapError(err) {
  if (!err) return false;
  if (err.code === "FATAL_BOOTSTRAP" || err.code === "MIGRATION_FAILED") return true;
  const msg = messageLower(err);
  return (
    msg.includes("migration") && (msg.includes("failed") || msg.includes("corrupt"))
  );
}

function infraErrorSignature(err) {
  const code = err?.code ?? "none";
  const msg = messageLower(err).slice(0, 80);
  return `${code}:${msg}`;
}

function shouldLogInfraError(err) {
  const signature = infraErrorSignature(err);
  const now = Date.now();
  const expiresAt = infraLogDedupe.get(signature);
  if (expiresAt && expiresAt > now) return false;
  infraLogDedupe.set(signature, now + INFRA_LOG_DEDUPE_MS);
  return true;
}

function resetInfraLogDedupeForTests() {
  infraLogDedupe.clear();
}

module.exports = {
  NETWORK_CODES,
  TRANSIENT_PG_SQLSTATES,
  isNetworkError,
  isTransientPgError,
  isRecoverableInfraError,
  isNonRetryablePgError,
  isFatalApplicationError,
  isFatalBootstrapError,
  shouldLogInfraError,
  infraErrorSignature,
  resetInfraLogDedupeForTests,
};
