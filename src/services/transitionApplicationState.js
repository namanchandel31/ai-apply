const { logInfo } = require("../utils/logger");
const { APPLICATION_STATUS } = require("../domain/applicationStatus/constants/uiStatuses");
const {
  enqueuePostCommitPublish,
  markApplicationPublishCommitted,
  flushPostCommitPublishes,
} = require("../realtime/postCommitPublishQueue");
const {
  isTerminalApplicationStatus,
  _incrementOrchestrationVersion: incrementOrchestrationVersion,
  _bumpOrchestrationEpoch: bumpOrchestrationEpoch,
} = require("./orchestrationVersion");

function isTransactionalClient(client) {
  return Boolean(client && typeof client.release === "function");
}

function schedulePublishAfterTransition(client, applicationId, userId, options = {}) {
  enqueuePostCommitPublish(applicationId, userId, {
    publishSource: "app_transition",
    ...options,
  });
  if (!isTransactionalClient(client)) {
    markApplicationPublishCommitted(applicationId);
    void flushPostCommitPublishes();
  }
}

function scheduleRevivePublish(client, applicationId, userId) {
  schedulePublishAfterTransition(client, applicationId, userId, { forceRevive: true });
}

class StateTransitionConflict extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = "StateTransitionConflict";
    this.code = "STATE_TRANSITION_CONFLICT";
    this.meta = meta;
  }
}

function normalizeExpected(expectedStatus) {
  return Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
}

/**
 * Atomic CAS transition for applications.application_status.
 * orchestrationBump:
 *   - 'none' (default): version++ after successful CAS
 *   - 'revive': epoch+version++ only (no status CAS)
 *   - 'revive_with_transition': CAS then single epoch+version++ (no extra version++)
 */
async function transitionApplicationState(client, params) {
  const {
    applicationId,
    userId = null,
    expectedStatus,
    nextStatus,
    reviewReason = undefined,
    clearReviewReason = false,
    patch = {},
    orchestrationBump = "none",
  } = params;

  if (orchestrationBump === "revive") {
    const meta = await bumpOrchestrationEpoch(client, applicationId, {
      bumpMode: "revive",
      triggeringTransition: "revive",
    });
    const rowRes = await client.query(
      userId
        ? `SELECT * FROM applications WHERE id = $1 AND user_id = $2`
        : `SELECT * FROM applications WHERE id = $1`,
      userId ? [applicationId, userId] : [applicationId]
    );
    const row = rowRes.rows[0];
    if (!row) {
      return { ok: false, conflict: true, currentStatus: null };
    }
    if (row.user_id) {
      scheduleRevivePublish(client, applicationId, row.user_id);
    }
    return { ok: true, row, orchestrationMeta: meta };
  }

  const expected = normalizeExpected(expectedStatus);

  if (nextStatus === APPLICATION_STATUS.NEEDS_REVIEW && !reviewReason) {
    throw new Error("reviewReason required when transitioning to needs_review");
  }

  const sets = ["application_status = $2", "updated_at = NOW()"];
  const values = [applicationId, nextStatus];
  let idx = 3;

  if (reviewReason !== undefined) {
    sets.push(`review_reason = $${idx}`);
    values.push(reviewReason);
    idx += 1;
  } else if (clearReviewReason) {
    sets.push("review_reason = NULL");
  }

  if (nextStatus === APPLICATION_STATUS.SENT) {
    sets.push("sent_at = COALESCE(sent_at, NOW())", "completed_at = COALESCE(completed_at, NOW())");
  }
  if (nextStatus === APPLICATION_STATUS.FAILED) {
    sets.push("failed_at = COALESCE(failed_at, NOW())");
  }
  if (patch.lastError !== undefined) {
    sets.push(`last_error = $${idx}`);
    values.push(patch.lastError);
    idx += 1;
  }
  if (patch.failureStage !== undefined) {
    sets.push(`failure_stage = $${idx}`);
    values.push(patch.failureStage);
    idx += 1;
  }
  if (patch.retryCountIncrement) {
    sets.push("retry_count = retry_count + 1");
  }

  let where = `id = $1 AND application_status::text = ANY($${idx}::text[])`;
  values.push(expected);
  idx += 1;

  if (userId) {
    where += ` AND user_id = $${idx}`;
    values.push(userId);
    idx += 1;
  }

  const sql = `UPDATE applications SET ${sets.join(", ")} WHERE ${where} RETURNING *`;
  const { rows } = await client.query(sql, values);

  if (!rows.length) {
    const current = await client.query(
      userId
        ? `SELECT application_status, review_reason FROM applications WHERE id = $1 AND user_id = $2`
        : `SELECT application_status, review_reason FROM applications WHERE id = $1`,
      userId ? [applicationId, userId] : [applicationId]
    );
    const currentStatus = current.rows[0]?.application_status ?? null;
    logInfo("state_transition_conflict", {
      applicationId,
      expected,
      nextStatus,
      currentStatus,
    });
    return {
      ok: false,
      conflict: true,
      currentStatus,
    };
  }

  const row = rows[0];
  const orchestrationMeta =
    orchestrationBump === "revive_with_transition"
      ? await bumpOrchestrationEpoch(client, applicationId, {
          bumpMode: "revive_with_transition",
          fromStatus: expected[0],
          toStatus: nextStatus,
          triggeringTransition: `${expected[0]}_to_${nextStatus}`,
        })
      : await incrementOrchestrationVersion(client, applicationId, {
          bumpMode: "app_transition",
          fromStatus: expected[0],
          toStatus: nextStatus,
          triggeringTransition: `${expected[0]}_to_${nextStatus}`,
        });

  if (row.user_id) {
    const enteringTerminal = isTerminalApplicationStatus(nextStatus);
    const publishSource = orchestrationBump === "revive_with_transition" ? "revive" : "app_transition";
    if (orchestrationBump === "revive_with_transition") {
      scheduleRevivePublish(client, applicationId, row.user_id);
    } else {
      schedulePublishAfterTransition(client, applicationId, row.user_id, {
        enteringTerminal,
        publishSource,
        expectedVersion: Number(orchestrationMeta?.orchestration_version) || 0,
      });
    }
  }

  return { ok: true, row, orchestrationMeta };
}

module.exports = {
  transitionApplicationState,
  StateTransitionConflict,
};
