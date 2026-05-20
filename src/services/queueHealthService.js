const { getAllQueueCounts } = require("../queues/validateQueueSystem");
const { PROCESS_APPLICATION_QUEUE, SEND_APPLICATION_QUEUE } = require("../queues/queueConstants");

/**
 * Fetch queue metrics for observability (all BullMQ queues).
 */
async function getQueueHealth() {
  const counts = await getAllQueueCounts();
  return {
    queues: [PROCESS_APPLICATION_QUEUE, SEND_APPLICATION_QUEUE],
    workerMode: require("../config").queue.workerDeploymentMode(),
    counts,
  };
}

module.exports = {
  getQueueHealth,
};
