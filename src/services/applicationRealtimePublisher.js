const {
  EVENT_APPLICATION_UPDATED,
  CHANNEL_APPLICATIONS,
  publishApplicationUpdate,
  clearPublishCache,
  buildRealtimePayload,
  shouldSkipDuplicatePublish,
  resetPublishStateForTests,
} = require("../realtime/publishApplicationUpdate");

function resetRealtimePublishStateForTests() {
  resetPublishStateForTests();
  const { resetPostCommitQueueForTests } = require("../realtime/postCommitPublishQueue");
  resetPostCommitQueueForTests();
}

function scheduleRevivePublish(applicationId, userId) {
  const { scheduleApplicationRealtimePublish } = require("../realtime/postCommitPublishQueue");
  scheduleApplicationRealtimePublish(applicationId, userId, { forceRevive: true });
}

function scheduleApplicationRealtimePublish(applicationId, userId, options = {}) {
  const { enqueuePostCommitPublish } = require("../realtime/postCommitPublishQueue");
  enqueuePostCommitPublish(applicationId, userId, options);
}

module.exports = {
  EVENT_APPLICATION_UPDATED,
  CHANNEL_APPLICATIONS,
  publishApplicationUpdate,
  scheduleApplicationRealtimePublish,
  scheduleRevivePublish,
  clearPublishCache,
  buildRealtimePayload,
  shouldSkipDuplicatePublish,
  resetRealtimePublishStateForTests,
};
