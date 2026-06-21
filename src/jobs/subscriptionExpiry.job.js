const { logInfo, logError } = require("../utils/logger");
const subscriptionService = require("../services/subscriptionService");

const EXPIRY_INTERVAL_MS = 5 * 60_000; // every 5 minutes

let started = false;

async function runOnce() {
  try {
    const count = await subscriptionService.expireElapsed();
    return count;
  } catch (err) {
    logError("SUBSCRIPTION_EXPIRY_JOB_ERROR", err, { component: "api" });
    return 0;
  }
}

/**
 * Periodically flips elapsed access periods to 'expired'. Access is also checked
 * at request time via entitlementService, so this job is for housekeeping/state
 * accuracy rather than enforcement.
 */
function startSubscriptionExpiryJob() {
  if (started) return;
  started = true;
  logInfo("SUBSCRIPTION_EXPIRY_JOB_STARTED", { component: "api", intervalMs: EXPIRY_INTERVAL_MS });
  // Kick off shortly after boot, then on an interval.
  setTimeout(() => { runOnce(); }, 15_000).unref?.();
  setInterval(() => { runOnce(); }, EXPIRY_INTERVAL_MS).unref?.();
}

module.exports = { startSubscriptionExpiryJob, runOnce };
