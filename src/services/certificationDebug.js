const { logInfo } = require("../utils/logger");

function logCertificationDebug(phase, data = {}) {
  logInfo("CERTIFICATION_DEBUG", { phase, ...data });
  // #region agent log
  fetch("http://127.0.0.1:7895/ingest/718dab8a-57b8-413a-b1ad-ea759aa5bf96", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "f71764",
    },
    body: JSON.stringify({
      sessionId: "f71764",
      runId: "cert-fix",
      hypothesisId: "A",
      location: "certificationDebug.js",
      message: "CERTIFICATION_DEBUG",
      data: { phase, ...data },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

module.exports = { logCertificationDebug };
