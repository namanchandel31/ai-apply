const { pool } = require("../db");
const {
  getApplicationStatusBundle,
  getApplicationStatusSnapshot,
} = require("../services/applicationStatusQueryService");
const {
  EVENT_APPLICATION_UPDATED,
  CHANNEL_APPLICATIONS,
} = require("../contracts/applicationEvents");
const { serializeApplication, deriveJdEnrichment } = require("../services/applicationSerializer");
const { serializeApplicationFromSnapshot } = require("../services/applicationStatusForPoll");
const { fanOutRealtimePayload } = require("./realtimeDispatch");
const { appendReplayEvent } = require("./sseReplayBuffer");
const { logError, logDebug } = require("../utils/logger");
const { metrics } = require("../observability/orchestrationMetrics");
const { isTerminalApplicationStatus } = require("../services/orchestrationVersion");
const {
  logRealtimeLifecycle,
  envelopeFromPayload,
} = require("./realtimeLifecycleLog");

/** @type {Map<string, { terminal: boolean, version: number, epoch: number }>} */
const lastPublished = new Map();
const recentPublishKeys = new Map();
const DEDUPE_MS = 400;
const bundleCache = new Map();
const BUNDLE_CACHE_TTL_MS = 2000;

function buildRealtimePayload(applicationId, userId, serialized, meta) {
  const jdEnrichment = serialized.jdEnrichment ?? deriveJdEnrichment(serialized);
  const payload = {
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
    role: serialized.role ?? null,
    company: serialized.company ?? null,
  };
  if (jdEnrichment) {
    payload.jdEnrichment = jdEnrichment;
  }
  return payload;
}

function shouldSkipDuplicatePublish(payload) {
  const updatedAt = payload.updatedAt ?? "";
  const key = `${payload.applicationId}:${payload.status}:${updatedAt}`;
  const now = Date.now();
  const expiresAt = recentPublishKeys.get(key);
  if (expiresAt && expiresAt > now) {
    metrics.increment("orchestration.realtime.dedupe_skip");
    return true;
  }
  recentPublishKeys.set(key, now + DEDUPE_MS);
  return false;
}

function getCachedSerialized(applicationId, version, epoch) {
  const entry = bundleCache.get(applicationId);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    bundleCache.delete(applicationId);
    return null;
  }
  if (entry.version !== version || entry.epoch !== epoch) return null;
  metrics.increment("orchestration.db.status_bundle_cache_hit");
  return entry.serialized;
}

function setCachedSerialized(applicationId, version, epoch, serialized) {
  bundleCache.set(applicationId, {
    version,
    epoch,
    serialized,
    expiresAt: Date.now() + BUNDLE_CACHE_TTL_MS,
  });
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

async function loadSerializedForPublish(applicationId, userId, client, options, metaRow) {
  const appStatus = metaRow.application_status;
  const alreadyTerminal = isTerminalApplicationStatus(appStatus);
  const version = Number(metaRow.orchestration_version) || 0;
  const epoch = Number(metaRow.orchestration_epoch) || 0;
  const bypassCache = options.forceRevive || options.enteringTerminal;

  if (!bypassCache && !alreadyTerminal) {
    const cached = getCachedSerialized(applicationId, version, epoch);
    if (cached) return cached;
  }

  let serialized;
  if (alreadyTerminal && !options.forceRevive) {
    const snapshot = await getApplicationStatusSnapshot(applicationId, userId, client);
    if (!snapshot) return null;
    serialized = serializeApplicationFromSnapshot(snapshot);
  } else {
    metrics.increment("orchestration.db.status_bundle");
    const bundle = await getApplicationStatusBundle(applicationId, userId, client);
    if (!bundle) return null;
    serialized = serializeApplication(bundle.row, bundle.jobs);
    if (!bypassCache) {
      setCachedSerialized(applicationId, version, epoch, serialized);
    }
  }

  return serialized;
}

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

    const serialized = await loadSerializedForPublish(
      applicationId,
      userId,
      client,
      options,
      metaRow
    );
    if (!serialized) return;

    const version = Number(metaRow.orchestration_version) || 0;
    const epoch = Number(metaRow.orchestration_epoch) || 0;

    const payload = buildRealtimePayload(applicationId, userId, serialized, {
      version,
      epoch,
    });

    if (shouldSkipDuplicatePublish(payload)) {
      logRealtimeLifecycle("REALTIME_PUBLISH_SKIPPED", {
        applicationId,
        userId,
        reason: "dedupe",
      });
      return;
    }

    const { eventId, payload: withEventId } = await appendReplayEvent(userId, payload);
    logRealtimeLifecycle("REALTIME_PUBLISH_EMITTED", envelopeFromPayload(withEventId));
    fanOutRealtimePayload(withEventId);
    metrics.increment("orchestration.realtime.publish");

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

function clearPublishCache(applicationId) {
  lastPublished.delete(applicationId);
  bundleCache.delete(applicationId);
}

function resetPublishStateForTests() {
  lastPublished.clear();
  recentPublishKeys.clear();
  bundleCache.clear();
}

module.exports = {
  EVENT_APPLICATION_UPDATED,
  CHANNEL_APPLICATIONS,
  publishApplicationUpdate,
  clearPublishCache,
  buildRealtimePayload,
  shouldSkipDuplicatePublish,
  resetPublishStateForTests,
};
