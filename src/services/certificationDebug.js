const { logInfo } = require("../utils/logger");

function logCertificationDebug(phase, data = {}) {
  logInfo("CERTIFICATION_DEBUG", { phase, ...data });
}

module.exports = { logCertificationDebug };
