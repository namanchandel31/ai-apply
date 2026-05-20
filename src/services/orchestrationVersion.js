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

function assertMonotonicBump(before, after, applicationId) {
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
  }
  return after;
}

/**
 * Internal: version++ only (used by transition layer).
 */
async function incrementOrchestrationVersion(client, applicationId) {
  const before = await loadOrchestrationMeta(client, applicationId);
  const { rows } = await client.query(
    `UPDATE applications
     SET orchestration_version = orchestration_version + 1,
         updated_at = NOW()
     WHERE id = $1
     RETURNING orchestration_version, orchestration_epoch, updated_at`,
    [applicationId]
  );
  return assertMonotonicBump(before, rows[0] ?? null, applicationId);
}

/**
 * Internal: epoch++ and version++ (revive; transition layer only).
 */
async function bumpOrchestrationEpoch(client, applicationId) {
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
  return assertMonotonicBump(before, rows[0] ?? null, applicationId);
}

module.exports = {
  isTerminalApplicationStatus,
  TERMINAL_STATUSES,
  /** @internal transition layer only */
  _incrementOrchestrationVersion: incrementOrchestrationVersion,
  _bumpOrchestrationEpoch: bumpOrchestrationEpoch,
};
