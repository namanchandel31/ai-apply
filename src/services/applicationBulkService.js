const { pool } = require("../db");
const { recordEvent } = require("../models/applicationEventModel");
const { getTrackerStatusOptions } = require("./trackerStatusService");

const MAX_BULK_SIZE = 100;

function normalizeApplicationIds(applicationIds) {
  if (!Array.isArray(applicationIds) || !applicationIds.length) {
    const err = new Error("applicationIds must be a non-empty array");
    err.code = "BAD_REQUEST";
    throw err;
  }
  const ids = [...new Set(applicationIds.map((id) => String(id || "").trim()).filter(Boolean))];
  if (!ids.length) {
    const err = new Error("applicationIds must contain at least one valid id");
    err.code = "BAD_REQUEST";
    throw err;
  }
  if (ids.length > MAX_BULK_SIZE) {
    const err = new Error(`Cannot update more than ${MAX_BULK_SIZE} applications at once`);
    err.code = "BAD_REQUEST";
    throw err;
  }
  return ids;
}

async function assertOwnedApplicationIds(userId, applicationIds, client = pool) {
  const { rows } = await client.query(
    `SELECT id FROM applications WHERE user_id = $1 AND id = ANY($2::uuid[])`,
    [userId, applicationIds]
  );
  const owned = new Set(rows.map((r) => r.id));
  const missing = applicationIds.filter((id) => !owned.has(id));
  if (missing.length) {
    const err = new Error("One or more applications were not found");
    err.code = "NOT_FOUND";
    throw err;
  }
  return owned;
}

async function bulkSetApplicationTrackerStatus(userId, applicationIds, trackerStatusId, reqId) {
  const ids = normalizeApplicationIds(applicationIds);
  await assertOwnedApplicationIds(userId, ids);

  let nextStatusId = null;
  if (trackerStatusId != null && trackerStatusId !== "") {
    const options = await getTrackerStatusOptions(userId);
    const match = options.find((o) => o.id === trackerStatusId);
    if (!match) {
      const err = new Error("Unknown tracker status");
      err.code = "BAD_REQUEST";
      throw err;
    }
    nextStatusId = trackerStatusId;
  }

  const { rowCount } = await pool.query(
    `UPDATE applications
     SET tracker_status_id = $3, updated_at = NOW()
     WHERE user_id = $1 AND id = ANY($2::uuid[])`,
    [userId, ids, nextStatusId]
  );

  await Promise.all(
    ids.map((applicationId) =>
      recordEvent({
        applicationId,
        eventType: "tracker_status_bulk_updated",
        actorType: "user",
        actorId: String(userId),
        metadata: { reqId, trackerStatusId: nextStatusId },
      })
    )
  );

  return { updatedCount: rowCount, trackerStatusId: nextStatusId };
}

async function bulkDeleteApplications(userId, applicationIds, reqId) {
  const ids = normalizeApplicationIds(applicationIds);
  await assertOwnedApplicationIds(userId, ids);

  const { rows } = await pool.query(
    `DELETE FROM applications
     WHERE user_id = $1 AND id = ANY($2::uuid[])
     RETURNING id`,
    [userId, ids]
  );

  return { deletedCount: rows.length, deletedIds: rows.map((r) => r.id) };
}

module.exports = {
  bulkSetApplicationTrackerStatus,
  bulkDeleteApplications,
  MAX_BULK_SIZE,
};
