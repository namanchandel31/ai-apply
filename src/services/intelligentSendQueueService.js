const { intelligentSendWakeQueue, armIntelligentSendWake } = require("../queues/intelligentSendWakeQueue");
const { enqueueSendJob } = require("../queues/sendApplicationQueue");
const { createJob } = require("../models/applicationJobModel");
const sendQueueModel = require("../models/sendQueueModel");
const { pool } = require("../db");
const { withPgTransaction } = require("../db/pgClient");
const { SCHEDULER_STATE, SEND_QUEUE_ENTRY_STATUS } = require("../constants/schedulerState");
const config = require("../config");
const { logInfo, logError } = require("../utils/logger");
const { recordEvent } = require("../models/applicationEventModel");
const { publishImmediately } = require("../realtime/postCommitPublishQueue");
const { invalidateBundleCache } = require("../realtime/publishApplicationUpdate");

const QUEUE_PUBLISH_SOURCES = new Set([
  "intelligent_send_queued",
  "intelligent_send_dispatched",
  "intelligent_send_paused",
  "intelligent_send_resumed",
  "intelligent_send_estimate_refresh",
]);

async function publishQueueRealtimeUpdate(applicationId, userId, publishSource) {
  if (!applicationId || !userId) return;
  try {
    if (QUEUE_PUBLISH_SOURCES.has(publishSource)) {
      invalidateBundleCache(applicationId);
    }
    await publishImmediately(applicationId, userId, {
      publishSource,
      bypassBundleCache: QUEUE_PUBLISH_SOURCES.has(publishSource),
    });
  } catch (err) {
    logError("intelligent_send_realtime_publish_failed", err, {
      applicationId,
      userId,
      publishSource,
    });
  }
}

function randomGapMs() {
  const { minDelaySeconds, maxDelaySeconds } = config.intelligentSendQueue;
  const min = minDelaySeconds * 1000;
  const max = maxDelaySeconds * 1000;
  return min + Math.floor(Math.random() * (max - min + 1));
}

function avgGapMs() {
  const { minDelaySeconds, maxDelaySeconds } = config.intelligentSendQueue;
  return ((minDelaySeconds + maxDelaySeconds) / 2) * 1000;
}

function syncSchedulerStateFromCounts({ pausedAt, waitingCount }) {
  if (pausedAt) return SCHEDULER_STATE.PAUSED;
  if (waitingCount > 0) return SCHEDULER_STATE.ACTIVE;
  return SCHEDULER_STATE.IDLE;
}

function formatNextSendLabel(scheduler) {
  if (!scheduler) return "—";
  if (scheduler.scheduler_state === SCHEDULER_STATE.PAUSED) return "Paused";
  if (scheduler.scheduler_state === SCHEDULER_STATE.IDLE) return "—";
  if (!scheduler.next_dispatch_at) return "—";
  const at = new Date(scheduler.next_dispatch_at);
  const diffMs = at.getTime() - Date.now();
  if (diffMs <= 60_000) return "In 1 minute";
  if (diffMs < 3_600_000) {
    const mins = Math.max(1, Math.round(diffMs / 60_000));
    return `In ${mins} minute${mins === 1 ? "" : "s"}`;
  }
  return at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

async function recalculateWaitingEstimates(userId, client = pool) {
  const scheduler = await sendQueueModel.ensureScheduler(userId, client);
  const state = syncSchedulerStateFromCounts({
    pausedAt: scheduler.paused_at,
    waitingCount: await sendQueueModel.countActiveWaiting(userId, client),
  });

  if (state !== SCHEDULER_STATE.ACTIVE || !scheduler.next_dispatch_at) {
    await sendQueueModel.clearWaitingEstimates(userId, client);
    return;
  }

  const waiting = await sendQueueModel.listWaitingOrdered(userId, client);
  const base = new Date(scheduler.next_dispatch_at).getTime();
  const gap = avgGapMs();
  for (let i = 0; i < waiting.length; i += 1) {
    const estimated = new Date(base + i * gap);
    await sendQueueModel.setWaitingEstimate(waiting[i].id, estimated, client);
  }
}

async function syncSchedulerState(userId, client = pool) {
  await sendQueueModel.reconcileOrphanedQueueEntries(userId, client);
  const scheduler = await sendQueueModel.ensureScheduler(userId, client);
  const waitingCount = await sendQueueModel.countActiveWaiting(userId, client);
  const nextState = syncSchedulerStateFromCounts({
    pausedAt: scheduler.paused_at,
    waitingCount,
  });
  if (scheduler.scheduler_state !== nextState) {
    await sendQueueModel.updateScheduler(userId, { schedulerState: nextState }, client);
  }
  return nextState;
}

async function dispatchHeadIfDue(userId, { force = false } = {}) {
  return withPgTransaction(pool, async (client) => {
    await sendQueueModel.reconcileOrphanedQueueEntries(userId, client);
    await sendQueueModel.updateScheduler(
      userId,
      { lastSchedulerRunAt: new Date() },
      client
    );

    const scheduler = await sendQueueModel.getScheduler(userId, client, { forUpdate: true });
    if (!scheduler) return { dispatched: false, reason: "no_scheduler" };
    if (scheduler.scheduler_state === SCHEDULER_STATE.PAUSED) {
      return { dispatched: false, reason: "paused" };
    }

    const waitingCount = await sendQueueModel.countActiveWaiting(userId, client);
    if (waitingCount === 0) {
      await sendQueueModel.updateScheduler(
        userId,
        { schedulerState: SCHEDULER_STATE.IDLE },
        client
      );
      return { dispatched: false, reason: "empty" };
    }

    const due =
      force ||
      !scheduler.next_dispatch_at ||
      new Date(scheduler.next_dispatch_at).getTime() <= Date.now();
    if (!due) {
      return { dispatched: false, reason: "not_due", nextDispatchAt: scheduler.next_dispatch_at };
    }

    const head = await sendQueueModel.getHeadWaitingForUpdate(userId, client);
    if (!head) return { dispatched: false, reason: "no_head" };

    await sendQueueModel.updateQueueEntryStatus(
      head.id,
      { status: SEND_QUEUE_ENTRY_STATUS.DISPATCHED, dispatchedAt: new Date() },
      client
    );

    const sendDbJob = await createJob(
      { applicationId: head.application_id, jobType: "send_email", status: "queued" },
      client
    );

    await recordEvent(
      {
        applicationId: head.application_id,
        eventType: "intelligent_send_dispatched",
        actorType: "worker",
        actorId: "intelligent-send-wake",
        metadata: { sendJobId: sendDbJob.id, queueEntryId: head.id },
      },
      client
    );

    return {
      dispatched: true,
      applicationId: head.application_id,
      recipientEmail: head.recipient_email,
      dbJobId: sendDbJob.id,
    };
  }).then(async (result) => {
    if (result.dispatched) {
      await enqueueSendJob(result.applicationId, userId, result.recipientEmail, {
        dbJobId: result.dbJobId,
      });
      await publishQueueRealtimeUpdate(
        result.applicationId,
        userId,
        "intelligent_send_dispatched"
      );
      logInfo("intelligent_send_dispatch", {
        userId,
        applicationId: result.applicationId,
      });
    } else if (result.reason === "not_due" && result.nextDispatchAt) {
      await armIntelligentSendWake(userId, new Date(result.nextDispatchAt));
    }
    return result;
  });
}

async function enqueue({
  userId,
  applicationId,
  recipientEmail,
  client = null,
}) {
  const email = String(recipientEmail || "").trim().toLowerCase();
  if (!email) {
    throw Object.assign(new Error("recipient email required"), { code: "INVALID_EMAIL" });
  }

  const run = async (dbClient) => {
    const existing = await sendQueueModel.getQueueEntryByApplicationId(
      applicationId,
      userId,
      dbClient
    );
    if (existing) {
      if (existing.status === SEND_QUEUE_ENTRY_STATUS.WAITING) {
        return { queued: true, alreadyQueued: true, applicationId };
      }
      if (existing.status === SEND_QUEUE_ENTRY_STATUS.DISPATCHED) {
        return { queued: false, alreadyProcessing: true, applicationId };
      }
      return { queued: false, alreadyQueued: true, applicationId };
    }

    const inserted = await sendQueueModel.insertQueueEntry(
      { userId, applicationId, recipientEmail: email },
      dbClient
    );
    if (!inserted) {
      return { queued: true, alreadyQueued: true, applicationId };
    }

    const scheduler = await sendQueueModel.ensureScheduler(userId, dbClient);
    const waitingCount = await sendQueueModel.countWaiting(userId, dbClient);
    const wasIdle = scheduler.scheduler_state === SCHEDULER_STATE.IDLE && waitingCount === 1;

    let nextDispatchAt = scheduler.next_dispatch_at;
    if (wasIdle && !scheduler.paused_at) {
      nextDispatchAt = new Date(Date.now() + randomGapMs());
      await sendQueueModel.updateScheduler(
        userId,
        { nextDispatchAt, schedulerState: SCHEDULER_STATE.ACTIVE },
        dbClient
      );
    } else if (!scheduler.paused_at && waitingCount > 0) {
      await sendQueueModel.updateScheduler(
        userId,
        { schedulerState: SCHEDULER_STATE.ACTIVE },
        dbClient
      );
    }

    await syncSchedulerState(userId, dbClient);
    await recalculateWaitingEstimates(userId, dbClient);

    await recordEvent(
      {
        applicationId,
        eventType: "intelligent_send_queued",
        actorType: "system",
        actorId: "intelligent-send-queue",
        metadata: { queueEntryId: inserted.id },
      },
      dbClient
    );

    return { queued: true, applicationId, nextDispatchAt };
  };

  const result = client ? await run(client) : await withPgTransaction(pool, run);

  // #region agent log
  try {
    const fs = require("fs");
    const path = require("path");
    fs.appendFileSync(
      path.join(process.cwd(), "debug-a0311e.log"),
      JSON.stringify({
        sessionId: "a0311e",
        location: "intelligentSendQueueService.js:enqueue",
        message: "enqueue_result",
        data: {
          applicationId,
          queued: result.queued,
          alreadyQueued: Boolean(result.alreadyQueued),
          alreadyProcessing: Boolean(result.alreadyProcessing),
          willPublish: Boolean(result.queued),
        },
        timestamp: Date.now(),
        hypothesisId: "H6",
        runId: "queued-sending-fix-v2",
      }) + "\n"
    );
  } catch {
    /* ignore */
  }
  // #endregion

  if (result.queued) {
    const scheduler = await sendQueueModel.getScheduler(userId);
    if (
      scheduler?.scheduler_state === SCHEDULER_STATE.ACTIVE &&
      scheduler.next_dispatch_at &&
      !result.alreadyQueued
    ) {
      await armIntelligentSendWake(userId, new Date(scheduler.next_dispatch_at));
    }
    await publishQueueRealtimeUpdate(applicationId, userId, "intelligent_send_queued");
  }

  return result;
}

async function onSendCompleted({ userId, applicationId }) {
  await withPgTransaction(pool, async (client) => {
    const entry = await sendQueueModel.getQueueEntryByApplicationId(applicationId, userId, client);
    if (
      entry &&
      (entry.status === SEND_QUEUE_ENTRY_STATUS.DISPATCHED ||
        entry.status === SEND_QUEUE_ENTRY_STATUS.WAITING)
    ) {
      await sendQueueModel.updateQueueEntryStatus(
        entry.id,
        { status: SEND_QUEUE_ENTRY_STATUS.COMPLETED, completedAt: new Date() },
        client
      );
    }

    const nextDispatchAt = new Date(Date.now() + randomGapMs());
    await sendQueueModel.updateScheduler(
      userId,
      { lastCompletedSendAt: new Date(), nextDispatchAt },
      client
    );
    await syncSchedulerState(userId, client);
    await recalculateWaitingEstimates(userId, client);
  });

  const scheduler = await sendQueueModel.getScheduler(userId);
  if (scheduler?.scheduler_state === SCHEDULER_STATE.ACTIVE) {
    await armIntelligentSendWake(userId, new Date(scheduler.next_dispatch_at));
  }

  const waiting = await sendQueueModel.listWaitingOrdered(userId);
  for (const row of waiting) {
    await publishQueueRealtimeUpdate(
      row.application_id,
      userId,
      "intelligent_send_estimate_refresh"
    );
  }
}

async function pauseQueue(userId) {
  await withPgTransaction(pool, async (client) => {
    await sendQueueModel.ensureScheduler(userId, client);
    await sendQueueModel.updateScheduler(
      userId,
      { pausedAt: new Date(), schedulerState: SCHEDULER_STATE.PAUSED },
      client
    );
    await sendQueueModel.clearWaitingEstimates(userId, client);
  });

  try {
    const job = await intelligentSendWakeQueue.getJob(`intelligent-send:wake:${userId}`);
    if (job) await job.remove();
  } catch {
    /* best effort */
  }

  logInfo("send_queue_paused", { userId });
  const waiting = await sendQueueModel.listWaitingOrdered(userId);
  for (const row of waiting) {
    await publishQueueRealtimeUpdate(row.application_id, userId, "intelligent_send_paused");
  }
  return { paused: true, schedulerState: SCHEDULER_STATE.PAUSED };
}

async function resumeQueue(userId) {
  await withPgTransaction(pool, async (client) => {
    await sendQueueModel.ensureScheduler(userId, client);
    const waitingCount = await sendQueueModel.countWaiting(userId, client);
    const updates = {
      pausedAt: null,
      nextDispatchAt: waitingCount > 0 ? new Date() : null,
      schedulerState:
        waitingCount > 0 ? SCHEDULER_STATE.ACTIVE : SCHEDULER_STATE.IDLE,
    };
    await sendQueueModel.updateScheduler(userId, updates, client);
    await recalculateWaitingEstimates(userId, client);
  });

  const dispatch = await dispatchHeadIfDue(userId, { force: true });
  logInfo("send_queue_resumed", { userId, dispatched: dispatch.dispatched });
  const waiting = await sendQueueModel.listWaitingOrdered(userId);
  for (const row of waiting) {
    await publishQueueRealtimeUpdate(row.application_id, userId, "intelligent_send_resumed");
  }
  return {
    resumed: true,
    schedulerState: SCHEDULER_STATE.ACTIVE,
    dispatched: dispatch.dispatched,
  };
}

async function skipAndSendNow(userId, applicationId) {
  const entry = await sendQueueModel.getQueueEntryByApplicationId(applicationId, userId);
  if (!entry || entry.status !== SEND_QUEUE_ENTRY_STATUS.WAITING) {
    const err = new Error("Application is not in the intelligent send queue");
    err.code = "NOT_IN_QUEUE";
    throw err;
  }

  await withPgTransaction(pool, async (client) => {
    await sendQueueModel.updateQueueEntryStatus(
      entry.id,
      { status: SEND_QUEUE_ENTRY_STATUS.SKIPPED },
      client
    );
    await syncSchedulerState(userId, client);
    await recalculateWaitingEstimates(userId, client);
    await recordEvent(
      {
        applicationId,
        eventType: "intelligent_send_now",
        actorType: "user",
        actorId: String(userId),
      },
      client
    );
  });

  const { directSendEnqueue } = require("./sendDispatchService");
  return directSendEnqueue({
    applicationId,
    userId,
    recipientEmail: entry.recipient_email,
  });
}

async function cancelQueueEntry(userId, applicationId, client = pool) {
  const entry = await sendQueueModel.getQueueEntryByApplicationId(applicationId, userId, client);
  if (!entry || entry.status !== SEND_QUEUE_ENTRY_STATUS.WAITING) return false;
  await sendQueueModel.updateQueueEntryStatus(
    entry.id,
    { status: SEND_QUEUE_ENTRY_STATUS.CANCELLED },
    client
  );
  await syncSchedulerState(userId, client);
  await recalculateWaitingEstimates(userId, client);
  return true;
}

async function getSummary(userId) {
  await sendQueueModel.reconcileOrphanedQueueEntries(userId);
  const scheduler = await sendQueueModel.ensureScheduler(userId);
  const counts = await sendQueueModel.getDailySummaryCounts(userId);
  const nextSendLabel = formatNextSendLabel(scheduler);
  const nextSendAt =
    scheduler.scheduler_state === SCHEDULER_STATE.ACTIVE && scheduler.next_dispatch_at
      ? new Date(scheduler.next_dispatch_at).toISOString()
      : null;

  return {
    schedulerState: scheduler.scheduler_state,
    nextSendAt,
    nextSendLabel,
    lastSchedulerRunAt: scheduler.last_scheduler_run_at
      ? new Date(scheduler.last_scheduler_run_at).toISOString()
      : null,
    queuedToday: counts.queued_today,
    sentToday: counts.sent_today,
    failedToday: counts.failed_today,
    queuedCount: counts.queued_count,
  };
}

async function recoverOverdueSchedulers(limit = 50) {
  const rows = await sendQueueModel.findOverdueActiveSchedulers(limit);
  for (const row of rows) {
    await armIntelligentSendWake(row.user_id, new Date(row.next_dispatch_at));
  }
  return { armed: rows.length };
}

module.exports = {
  randomGapMs,
  avgGapMs,
  recalculateWaitingEstimates,
  syncSchedulerState,
  dispatchHeadIfDue,
  enqueue,
  onSendCompleted,
  pauseQueue,
  resumeQueue,
  skipAndSendNow,
  cancelQueueEntry,
  getSummary,
  recoverOverdueSchedulers,
  formatNextSendLabel,
};
