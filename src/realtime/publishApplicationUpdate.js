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
const { shouldEmitPublish, recordEmitted, publishKey } = require("./publishDedupeRegistry");
const { isPublishWorthy } = require("./isUserVisibleTransition");
const { logError, logDebug, logInfo } = require("../utils/logger");
const { metrics } = require("../observability/orchestrationMetrics");
const { isTerminalApplicationStatus } = require("../services/orchestrationVersion");
const {
  logRealtimeLifecycle,
  envelopeFromPayload,
} = require("./realtimeLifecycleLog");
const {
  getTraceFields,
  mergeTraceIntoPayload,
} = require("../observability/orchestrationTraceContext");

/** @type {Map<string, { terminal: boolean, version: number, epoch: number, uiStatus?: string, status?: string }>} */
const lastPublished = new Map();
const bundleCache = new Map();
const BUNDLE_CACHE_TTL_MS = 2000;

function buildRealtimePayload(applicationId, userId, serialized, meta) {
  const jdEnrichment = serialized.jdEnrichment ?? deriveJdEnrichment(serialized);
  const trace = getTraceFields({ orchestrationId: applicationId, component: "realtime" });
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
    canSend: serialized.canSend,
    reviewReason: serialized.reviewReason ?? null,
    role: serialized.role ?? null,
    company: serialized.company ?? null,
    matchScore: serialized.matchScore ?? null,
    traceId: trace.traceId,
    requestId: trace.requestId,
    orchestrationId: applicationId,
  };
  if (jdEnrichment) {
    payload.jdEnrichment = jdEnrichment;
  }
  return payload;
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

  const publishSource = options.publishSource || options.source || "publish";
  const client = pool;

  try {
    const metaRow = await loadPublishMeta(client, applicationId);
    if (!metaRow) return;

    const appStatus = metaRow.application_status;
    const alreadyTerminal = isTerminalApplicationStatus(appStatus);
    const version = Number(metaRow.orchestration_version) || 0;
    const epoch = Number(metaRow.orchestration_epoch) || 0;
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
          version,
          publishSource,
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

    const meta = { version, epoch };

    if (!isPublishWorthy(meta, serialized, prev, options)) {
      if (
        prev &&
        prev.version === version &&
        prev.epoch === epoch &&
        (prev.uiStatus ?? prev.status) === (serialized.uiStatus || serialized.status)
      ) {
        logInfo("VERSION_UNCHANGED_SKIP", {
          applicationId,
          version,
          orchestrationEpoch: epoch,
          uiStatus: serialized.uiStatus,
          status: serialized.status,
          publishSource,
          component: "realtime",
        });
        metrics.increment("orchestration.realtime.version_unchanged_skip");
      } else {
        logInfo("PUBLISH_SKIPPED_NON_VISIBLE", {
          applicationId,
          uiStatus: serialized.uiStatus,
          publishSource,
          component: "realtime",
        });
        metrics.increment("orchestration.realtime.non_visible_skip");
      }
      return;
    }

    const payload = buildRealtimePayload(applicationId, userId, serialized, meta);
    const withTrace = mergeTraceIntoPayload(payload);

    const dedupe = shouldEmitPublish({
      applicationId,
      version,
      orchestrationEpoch: epoch,
      publishSource,
      blockedAtLayer: "publish_application_update",
    });
    if (!dedupe.allow) return;

    const { eventId, payload: withEventId } = await appendReplayEvent(userId, withTrace, {
      publishSource,
    });
    if (!withEventId) return;

    logRealtimeLifecycle("REALTIME_PUBLISH_EMITTED", {
      ...envelopeFromPayload(withEventId),
      eventId,
      publishSource,
      traceId: withEventId.traceId,
      requestId: withEventId.requestId,
    });

    fanOutRealtimePayload(withEventId, { publishSource, eventId });

    const key = publishKey(applicationId, version, epoch);
    recordEmitted(key, { eventId, publishSource });
    metrics.increment("orchestration.realtime.publish");

    lastPublished.set(applicationId, {
      terminal: serialized.terminal,
      version,
      epoch,
      uiStatus: serialized.uiStatus,
      status: serialized.status,
    });

    metrics.increment("orchestration.realtime.emitted", {
      terminal: String(withEventId.terminal),
    });
  } catch (err) {
    logError("REALTIME_PUBLISH_FAILED", err, {
      applicationId,
      userId,
      publishSource,
      ...getTraceFields({ orchestrationId: applicationId }),
    });
  }
}

function clearPublishCache(applicationId) {
  lastPublished.delete(applicationId);
  bundleCache.delete(applicationId);
}

function resetPublishStateForTests() {
  lastPublished.clear();
  bundleCache.clear();
}

module.exports = {
  EVENT_APPLICATION_UPDATED,
  CHANNEL_APPLICATIONS,
  publishApplicationUpdate,
  clearPublishCache,
  buildRealtimePayload,
  resetPublishStateForTests,
};
