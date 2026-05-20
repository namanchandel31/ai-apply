function isTransientPgError(err) {
  const code = err?.code;
  if (["ECONNRESET", "ETIMEDOUT", "08006"].includes(code)) return true;
  return /connection terminated unexpectedly/i.test(err?.message || "");
}

module.exports = { isTransientPgError };
