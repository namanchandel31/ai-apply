const { sendApplicationQueue } = require("../queues/sendApplicationQueue");

/**
 * Fetch queue metrics for observability.
 */
async function getQueueHealth() {
  const counts = await sendApplicationQueue.getJobCounts("waiting", "active", "failed", "delayed", "completed");
  return counts;
}

module.exports = {
  getQueueHealth,
};
