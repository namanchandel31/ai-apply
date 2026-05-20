const { performance } = require("perf_hooks");
const { getActiveOrchestrationForUser } = require("../services/orchestrationSnapshotService");
const { logDebug } = require("../utils/logger");
const { metrics } = require("../observability/orchestrationMetrics");
const { ok } = require("../utils/response");

async function getActiveOrchestrationController(req, res) {
  const started = performance.now();
  const states = await getActiveOrchestrationForUser(req.user.id);
  const durationMs = Math.round(performance.now() - started);

  metrics.histogram("orchestration.hydration.duration_ms", durationMs);
  logDebug(
    "HYDRATION_COMPLETE",
    {
      userId: req.user.id,
      reqId: req.requestId,
      count: states.length,
      durationMs,
      component: "hydration",
    },
    "hydration"
  );

  return ok(res, { states });
}

module.exports = { getActiveOrchestrationController };
