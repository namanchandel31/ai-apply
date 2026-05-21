const {
  markApplicationPublishCommitted,
  markAllPendingCommitted,
  flushPostCommitPublishes,
} = require("./postCommitPublishQueue");

async function flushRealtimeAfterDbCommit(applicationIds = []) {
  if (applicationIds.length) {
    for (const id of applicationIds) {
      if (id) markApplicationPublishCommitted(id);
    }
  } else {
    markAllPendingCommitted();
  }
  await flushPostCommitPublishes();
}

module.exports = { flushRealtimeAfterDbCommit };
