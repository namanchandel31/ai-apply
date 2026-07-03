const { createJob } = require("../models/applicationJobModel");
const { enqueueSendJob } = require("../queues/sendApplicationQueue");
const entitlementService = require("./entitlementService");
const intelligentSendQueueService = require("./intelligentSendQueueService");
const { FEATURE_KEYS } = require("../constants/featureKeys");
const { logInfo } = require("../utils/logger");

async function userHasIntelligentSendQueues(userId) {
  return entitlementService.hasEntitlement(userId, FEATURE_KEYS.CAN_USE_INTELLIGENT_SEND_QUEUES);
}

async function directSendEnqueue({ applicationId, userId, recipientEmail, client = null }) {
  const dbJob = await createJob(
    { applicationId, jobType: "send_email", status: "queued" },
    client ?? undefined
  );
  const result = await enqueueSendJob(applicationId, userId, recipientEmail, {
    dbJobId: dbJob.id,
  });
  logInfo("send_enqueued_direct", { applicationId, userId, dbJobId: dbJob.id });
  return { queued: true, dbJobId: dbJob.id, ...result };
}

/**
 * Single funnel for outbound send — intelligent queue or immediate BullMQ enqueue.
 */
async function requestApplicationSend({
  applicationId,
  userId,
  recipientEmail,
  immediate = false,
}) {
  const useQueue = !immediate && (await userHasIntelligentSendQueues(userId));

  if (useQueue) {
    return intelligentSendQueueService.enqueue({
      applicationId,
      userId,
      recipientEmail,
    });
  }

  return directSendEnqueue({ applicationId, userId, recipientEmail });
}

module.exports = {
  userHasIntelligentSendQueues,
  directSendEnqueue,
  requestApplicationSend,
};
