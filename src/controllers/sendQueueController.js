const intelligentSendQueueService = require("../services/intelligentSendQueueService");
const { userHasIntelligentSendQueues } = require("../services/sendDispatchService");

async function getSendQueueSummaryController(req, res) {
  try {
    const entitled = await userHasIntelligentSendQueues(req.user.id);
    if (!entitled) {
      return res.status(404).json({
        success: false,
        message: "Intelligent Send Queues is not available on your plan",
      });
    }
    const data = await intelligentSendQueueService.getSummary(req.user.id);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function pauseSendQueueController(req, res) {
  try {
    const entitled = await userHasIntelligentSendQueues(req.user.id);
    if (!entitled) {
      return res.status(404).json({ success: false, message: "Not available on your plan" });
    }
    const data = await intelligentSendQueueService.pauseQueue(req.user.id);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function resumeSendQueueController(req, res) {
  try {
    const entitled = await userHasIntelligentSendQueues(req.user.id);
    if (!entitled) {
      return res.status(404).json({ success: false, message: "Not available on your plan" });
    }
    const data = await intelligentSendQueueService.resumeQueue(req.user.id);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function sendApplicationNowController(req, res) {
  try {
    const entitled = await userHasIntelligentSendQueues(req.user.id);
    if (!entitled) {
      return res.status(404).json({ success: false, message: "Not available on your plan" });
    }
    const { id } = req.params;
    const result = await intelligentSendQueueService.skipAndSendNow(req.user.id, id);
    const { flushRealtimeAfterDbCommit } = require("../realtime/postCommitFlush");
    await flushRealtimeAfterDbCommit([id]);
    return res.json({ success: true, data: result });
  } catch (err) {
    const code = err.code === "NOT_IN_QUEUE" ? 400 : 500;
    return res.status(code).json({ success: false, message: err.message });
  }
}

module.exports = {
  getSendQueueSummaryController,
  pauseSendQueueController,
  resumeSendQueueController,
  sendApplicationNowController,
};
