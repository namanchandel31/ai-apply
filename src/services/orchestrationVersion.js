const { logInfo } = require("../utils/logger");
const { reportMonotonicViolation } = require("../utils/versionRegression");
const { APPLICATION_STATUS } = require("../domain/applicationStatus/constants/uiStatuses");

const TERMINAL_STATUSES = new Set([
  APPLICATION_STATUS.SENT,
  APPLICATION_STATUS.FAILED,
  APPLICATION_STATUS.CANCELLED,
  APPLICATION_STATUS.NEEDS_REVIEW,
]);

function isTerminalApplicationStatus(status) {
  return TERMINAL_STATUSES.has(status);
}

async function loadOrchestrationMeta(client, applicationId) {
  const { rows } = await client.query(
    `SELECT orchestration_version, orchestration_epoch FROM applications WHERE id = $1`,
    [applicationId]
  );
  return rows[0] ?? null;
}

function logVersionTransition(applicationId, before, after, fields = {}) {
  const previousVersion = Number(before?.orchestration_version) || 0;
  const previousEpoch = Number(before?.orchestration_epoch) || 0;
  const nextVersion = Number(after?.orchestration_version) || 0;
  const nextEpoch = Number(after?.orchestration_epoch) || 0;
  logInfo("VERSION_TRANSITION", {
    applicationId,
    previousVersion,
    nextVersion,
    previousEpoch,
    nextEpoch,
    triggeringTransition: fields.triggeringTransition,
    fromStatus: fields.fromStatus,
    toStatus: fields.toStatus,
    bumpMode: fields.bumpMode,
    component: "orchestration",
  });
}

function assertMonotonicBump(before, after, applicationId, logFields = {}) {
  if (!before || !after) return after;
  const prevV = Number(before.orchestration_version) || 0;
  const prevE = Number(before.orchestration_epoch) || 0;
  const nextV = Number(after.orchestration_version) || 0;
  const nextE = Number(after.orchestration_epoch) || 0;
  if (nextV < prevV || nextE < prevE) {
    reportMonotonicViolation({
      applicationId,
      prevVersion: prevV,
      nextVersion: nextV,
      prevEpoch: prevE,
      nextEpoch: nextE,
    });
  } else if (nextV > prevV || nextE > prevE) {
    logVersionTransition(applicationId, before, after, logFields);
  }
  return after;
}

/**
 * Internal: version++ only (used by transition layer).
 */
async function incrementOrchestrationVersion(client, applicationId, logFields = {}) {
  const before = await loadOrchestrationMeta(client, applicationId);
  const { rows } = await client.query(
    `UPDATE applications
     SET orchestration_version = orchestration_version + 1,
         updated_at = NOW()
     WHERE id = $1
     RETURNING orchestration_version, orchestration_epoch, updated_at`,
    [applicationId]
  );
  return assertMonotonicBump(before, rows[0] ?? null, applicationId, {
    bumpMode: logFields.bumpMode || "version",
    ...logFields,
  });
}

/**
 * Internal: epoch++ and version++ (revive; transition layer only).
 */
async function bumpOrchestrationEpoch(client, applicationId, logFields = {}) {
  const before = await loadOrchestrationMeta(client, applicationId);
  const { rows } = await client.query(
    `UPDATE applications
     SET orchestration_epoch = orchestration_epoch + 1,
         orchestration_version = orchestration_version + 1,
         updated_at = NOW()
     WHERE id = $1
     RETURNING orchestration_version, orchestration_epoch, updated_at`,
    [applicationId]
  );
  return assertMonotonicBump(before, rows[0] ?? null, applicationId, {
    bumpMode: logFields.bumpMode || "epoch",
    ...logFields,
  });
}

/** Job transitions that affect derived UI must bump version for ordering truth. */
async function bumpVersionForJobTransition(client, applicationId, logFields = {}) {
  return incrementOrchestrationVersion(client, applicationId, {
    bumpMode: "job_transition",
    triggeringTransition: logFields.triggeringTransition || "job_state",
    ...logFields,
  });
}

module.exports = {
  isTerminalApplicationStatus,
  TERMINAL_STATUSES,
  logVersionTransition,
  /** @internal transition layer only */
  _incrementOrchestrationVersion: incrementOrchestrationVersion,
  _bumpOrchestrationEpoch: bumpOrchestrationEpoch,
  bumpVersionForJobTransition,
};
