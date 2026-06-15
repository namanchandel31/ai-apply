const { markBullmqShuttingDown } = require("./connection");

/**
 * Close BullMQ queues on shutdown. Lives outside connection.js to avoid
 * connection ↔ processApplicationQueue ↔ sendApplicationQueue cycles.
 */
async function closeBullmqQueues() {
  markBullmqShuttingDown();
  const closes = [];
  try {
    const { processApplicationQueue } = require("./processApplicationQueue");
    closes.push(processApplicationQueue.close());
  } catch {
    /* queue module may not be loaded */
  }
  try {
    const { sendApplicationQueue } = require("./sendApplicationQueue");
    closes.push(sendApplicationQueue.close());
  } catch {
    /* queue module may not be loaded */
  }
  await Promise.allSettled(closes);
}

module.exports = { closeBullmqQueues };
