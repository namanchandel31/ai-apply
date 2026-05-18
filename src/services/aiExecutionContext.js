const aiCredentialService = require("./aiCredentialService");

/**
 * Per-request (or per-job) cache for decrypted credential chains.
 * Phase 2: swap store for Redis TTL keyed by userId:chainVersion.
 */
function createExecutionContext({ userId, reqId, jobId }) {
  let chainPromise = null;
  let chainVersion = null;

  async function getCredentialChain(options = {}) {
    if (!chainPromise) {
      chainPromise = aiCredentialService.resolveCredentialChainForUser(userId, options);
    }
    return chainPromise;
  }

  function invalidate() {
    chainPromise = null;
    chainVersion = null;
  }

  return {
    userId,
    reqId,
    jobId,
    getCredentialChain,
    invalidate,
    getChainVersion: () => chainVersion,
    setChainVersion: (v) => {
      chainVersion = v;
    },
  };
}

module.exports = { createExecutionContext };
