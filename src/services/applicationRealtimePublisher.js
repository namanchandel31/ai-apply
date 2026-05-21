const {
  EVENT_APPLICATION_UPDATED,
  CHANNEL_APPLICATIONS,
  publishApplicationUpdate,
  clearPublishCache,
  buildRealtimePayload,
  resetPublishStateForTests,
} = require("../realtime/publishApplicationUpdate");
const {
  shouldEmitPublish,
  resetPublishDedupeForTests,
} = require("../realtime/publishDedupeRegistry");

function resetRealtimePublishStateForTests() {
  resetPublishStateForTests();
  resetPublishDedupeForTests();
  const { resetPostCommitQueueForTests } = require("../realtime/postCommitPublishQueue");
  const { resetPublishBatchForTests } = require("../realtime/publishBatchProcessor");
  resetPostCommitQueueForTests();
  resetPublishBatchForTests();
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
  shouldEmitPublish,
  resetRealtimePublishStateForTests,
};
