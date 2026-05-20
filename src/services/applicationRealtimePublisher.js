const { pool } = require("../db");
const {
  getApplicationStatusBundle,
  getApplicationStatusSnapshot,
} = require("./applicationStatusQueryService");
const {
  EVENT_APPLICATION_UPDATED,
  CHANNEL_APPLICATIONS,
} = require("../contracts/applicationEvents");
const { serializeApplication } = require("./applicationSerializer");
const { serializeApplicationFromSnapshot } = require("./applicationStatusForPoll");
const { fanOutRealtimePayload } = require("../realtime/realtimeDispatch");
const { logError, logDebug } = require("../utils/logger");
const { metrics } = require("../observability/orchestrationMetrics");
const { isTerminalApplicationStatus } = require("./orchestrationVersion");

/** Coalesce bursts inside the same transaction / worker step. */
const pending = new Map();
let flushScheduled = false;

/** @type {Map<string, { terminal: boolean, version: number, epoch: number }>} */
const lastPublished = new Map();

function buildRealtimePayload(applicationId, userId, serialized, meta) {
  return {
    type: EVENT_APPLICATION_UPDATED,
    channel: CHANNEL_APPLICATIONS,
    applicationId,
    userId,
    version: meta.version,
    orchestrationEpoch: meta.epoch,
    updatedAt: serialized.updatedAt,
    status: serialized.status,
    uiStatus: serialized.uiStatus,
    terminal: serialized.terminal,
    executionTerminal: serialized.executionTerminal,
    pollable: serialized.pollable,
    canRetry: serialized.canRetry,
    canContinue: serialized.canContinue,
    reviewReason: serialized.reviewReason ?? null,
  };
}

async function loadPublishMeta(client, applicationId) {
  const queryClient = client || pool;
  const { rows } = await queryClient.query(
    `SELECT application_status, orchestration_version, orchestration_epoch, updated_at
     FROM applications WHERE id = $1`,
    [applicationId]
  );
  return rows[0] ?? null;
}

/**
 * @param {{ forceRevive?: boolean, enteringTerminal?: boolean }} options
 */
async function publishApplicationUpdate(applicationId, userId, options = {}) {
  if (!applicationId || !userId) return;

  const client = pool;
  try {
    const metaRow = await loadPublishMeta(client, applicationId);
    if (!metaRow) return;

    const appStatus = metaRow.application_status;
    const alreadyTerminal = isTerminalApplicationStatus(appStatus);
    const prev = lastPublished.get(applicationId);

    if (
      alreadyTerminal &&
      !options.forceRevive &&
      !options.enteringTerminal &&
      prev?.terminal === true
    ) {
      metrics.increment("orchestration.realtime.terminal_skip");
      logDebug(
        "REALTIME_TERMINAL_SKIP",
        {
          applicationId,
          userId,
          applicationStatus: appStatus,
          version: metaRow.orchestration_version,
          component: "realtime",
        },
        "realtime"
      );
      return;
    }

    let serialized;
    if (alreadyTerminal && !options.forceRevive) {
      const snapshot = await getApplicationStatusSnapshot(applicationId, userId, client);
      if (!snapshot) return;
      serialized = serializeApplicationFromSnapshot(snapshot);
    } else {
      const bundle = await getApplicationStatusBundle(applicationId, userId, client);
      if (!bundle) return;
      serialized = serializeApplication(bundle.row, bundle.jobs);
    }

    const version = Number(metaRow.orchestration_version) || 0;
    const epoch = Number(metaRow.orchestration_epoch) || 0;

    const payload = buildRealtimePayload(applicationId, userId, serialized, {
      version,
      epoch,
    });

    fanOutRealtimePayload(payload);
    lastPublished.set(applicationId, {
      terminal: serialized.terminal,
      version,
      epoch,
    });

    metrics.increment("orchestration.realtime.emitted", {
      terminal: String(payload.terminal),
    });
  } catch (err) {
    logError("REALTIME_PUBLISH_FAILED", err, { applicationId, userId });
  }
}

function scheduleApplicationRealtimePublish(applicationId, userId, options = {}) {
  if (!applicationId || !userId) return;
  pending.set(applicationId, { userId, options });
  if (flushScheduled) return;
  flushScheduled = true;
  setImmediate(() => {
    flushScheduled = false;
    const batch = new Map(pending);
    pending.clear();
    for (const [appId, entry] of batch) {
      void publishApplicationUpdate(appId, entry.userId, entry.options);
    }
  });
}

function scheduleRevivePublish(applicationId, userId) {
  scheduleApplicationRealtimePublish(applicationId, userId, { forceRevive: true });
}

function clearPublishCache(applicationId) {
  lastPublished.delete(applicationId);
}

module.exports = {
  EVENT_APPLICATION_UPDATED,
  CHANNEL_APPLICATIONS,
  publishApplicationUpdate,
  scheduleApplicationRealtimePublish,
  scheduleRevivePublish,
  clearPublishCache,
  buildRealtimePayload,
};
