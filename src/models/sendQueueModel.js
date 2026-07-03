const { pool } = require("../db");
const { SCHEDULER_STATE, SEND_QUEUE_ENTRY_STATUS } = require("../constants/schedulerState");

async function insertQueueEntry(
  { userId, applicationId, recipientEmail },
  client = pool
) {
  const { rows } = await client.query(
    `INSERT INTO send_queue_entries (user_id, application_id, recipient_email, status)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (application_id) DO NOTHING
     RETURNING *`,
    [userId, applicationId, recipientEmail, SEND_QUEUE_ENTRY_STATUS.WAITING]
  );
  return rows[0] ?? null;
}

async function getQueueEntryByApplicationId(applicationId, userId = null, client = pool) {
  const params = [applicationId];
  let sql = `SELECT * FROM send_queue_entries WHERE application_id = $1`;
  if (userId) {
    sql += ` AND user_id = $2`;
    params.push(userId);
  }
  const { rows } = await client.query(sql, params);
  return rows[0] ?? null;
}

async function countWaiting(userId, client = pool) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS count FROM send_queue_entries
     WHERE user_id = $1 AND status = $2`,
    [userId, SEND_QUEUE_ENTRY_STATUS.WAITING]
  );
  return rows[0]?.count ?? 0;
}

async function listWaitingOrdered(userId, client = pool) {
  const { rows } = await client.query(
    `SELECT sq.*
     FROM send_queue_entries sq
     INNER JOIN applications a ON a.id = sq.application_id AND a.user_id = sq.user_id
     WHERE sq.user_id = $1 AND sq.status = $2
       AND a.application_status NOT IN ('sent', 'failed')
     ORDER BY sq.created_at ASC, sq.id ASC`,
    [userId, SEND_QUEUE_ENTRY_STATUS.WAITING]
  );
  return rows;
}

async function getHeadWaitingForUpdate(userId, client) {
  const { rows } = await client.query(
    `SELECT sq.*
     FROM send_queue_entries sq
     INNER JOIN applications a ON a.id = sq.application_id AND a.user_id = sq.user_id
     WHERE sq.user_id = $1 AND sq.status = $2
       AND a.application_status NOT IN ('sent', 'failed')
     ORDER BY sq.created_at ASC, sq.id ASC
     LIMIT 1
     FOR UPDATE OF sq SKIP LOCKED`,
    [userId, SEND_QUEUE_ENTRY_STATUS.WAITING]
  );
  return rows[0] ?? null;
}

async function updateQueueEntryStatus(
  entryId,
  { status, dispatchedAt, completedAt, estimatedSendAt },
  client = pool
) {
  const sets = ["status = $2"];
  const values = [entryId, status];
  let idx = 3;
  if (dispatchedAt !== undefined) {
    sets.push(`dispatched_at = $${idx}`);
    values.push(dispatchedAt);
    idx += 1;
  }
  if (completedAt !== undefined) {
    sets.push(`completed_at = $${idx}`);
    values.push(completedAt);
    idx += 1;
  }
  if (estimatedSendAt !== undefined) {
    sets.push(`estimated_send_at = $${idx}`);
    values.push(estimatedSendAt);
    idx += 1;
  }
  const { rows } = await client.query(
    `UPDATE send_queue_entries SET ${sets.join(", ")} WHERE id = $1 RETURNING *`,
    values
  );
  return rows[0] ?? null;
}

async function clearWaitingEstimates(userId, client = pool) {
  await client.query(
    `UPDATE send_queue_entries SET estimated_send_at = NULL
     WHERE user_id = $1 AND status = $2`,
    [userId, SEND_QUEUE_ENTRY_STATUS.WAITING]
  );
}

async function setWaitingEstimate(entryId, estimatedSendAt, client = pool) {
  await client.query(
    `UPDATE send_queue_entries SET estimated_send_at = $2 WHERE id = $1`,
    [entryId, estimatedSendAt]
  );
}

async function getScheduler(userId, client = pool, { forUpdate = false } = {}) {
  const lock = forUpdate ? " FOR UPDATE" : "";
  const { rows } = await client.query(
    `SELECT * FROM user_send_schedulers WHERE user_id = $1${lock}`,
    [userId]
  );
  return rows[0] ?? null;
}

async function ensureScheduler(userId, client = pool) {
  const { rows } = await client.query(
    `INSERT INTO user_send_schedulers (user_id, scheduler_state)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO NOTHING
     RETURNING *`,
    [userId, SCHEDULER_STATE.IDLE]
  );
  if (rows[0]) return rows[0];
  return getScheduler(userId, client);
}

async function updateScheduler(
  userId,
  { schedulerState, nextDispatchAt, pausedAt, lastCompletedSendAt, lastSchedulerRunAt },
  client = pool
) {
  const sets = ["updated_at = NOW()"];
  const values = [userId];
  let idx = 2;
  if (schedulerState !== undefined) {
    sets.push(`scheduler_state = $${idx}`);
    values.push(schedulerState);
    idx += 1;
  }
  if (nextDispatchAt !== undefined) {
    sets.push(`next_dispatch_at = $${idx}`);
    values.push(nextDispatchAt);
    idx += 1;
  }
  if (pausedAt !== undefined) {
    sets.push(`paused_at = $${idx}`);
    values.push(pausedAt);
    idx += 1;
  }
  if (lastCompletedSendAt !== undefined) {
    sets.push(`last_completed_send_at = $${idx}`);
    values.push(lastCompletedSendAt);
    idx += 1;
  }
  if (lastSchedulerRunAt !== undefined) {
    sets.push(`last_scheduler_run_at = $${idx}`);
    values.push(lastSchedulerRunAt);
    idx += 1;
  }
  const { rows } = await client.query(
    `UPDATE user_send_schedulers SET ${sets.join(", ")} WHERE user_id = $1 RETURNING *`,
    values
  );
  return rows[0] ?? null;
}

async function findOverdueActiveSchedulers(limit = 50, client = pool) {
  const { rows } = await client.query(
    `SELECT s.*
     FROM user_send_schedulers s
     WHERE s.scheduler_state = $1
       AND s.next_dispatch_at IS NOT NULL
       AND s.next_dispatch_at <= NOW()
       AND EXISTS (
         SELECT 1 FROM send_queue_entries e
         WHERE e.user_id = s.user_id AND e.status = $2
       )
     ORDER BY s.next_dispatch_at ASC
     LIMIT $3`,
    [SCHEDULER_STATE.ACTIVE, SEND_QUEUE_ENTRY_STATUS.WAITING, limit]
  );
  return rows;
}

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function reconcileOrphanedQueueEntries(userId, client = pool) {
  const { rowCount } = await client.query(
    `UPDATE send_queue_entries sq
     SET status = $3, completed_at = COALESCE(sq.completed_at, NOW())
     FROM applications a
     WHERE sq.application_id = a.id
       AND sq.user_id = a.user_id
       AND sq.user_id = $1
       AND sq.status = ANY($2::text[])
       AND a.application_status IN ('sent', 'failed')`,
    [
      userId,
      [SEND_QUEUE_ENTRY_STATUS.WAITING, SEND_QUEUE_ENTRY_STATUS.DISPATCHED],
      SEND_QUEUE_ENTRY_STATUS.COMPLETED,
    ]
  );
  return rowCount ?? 0;
}

async function countActiveWaiting(userId, client = pool) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM send_queue_entries sq
     INNER JOIN applications a ON a.id = sq.application_id AND a.user_id = sq.user_id
     WHERE sq.user_id = $1
       AND sq.status = $2
       AND a.application_status NOT IN ('sent', 'failed')`,
    [userId, SEND_QUEUE_ENTRY_STATUS.WAITING]
  );
  return rows[0]?.count ?? 0;
}

async function getDailySummaryCounts(userId, client = pool) {
  const dayStart = startOfUtcDay();
  const activeWaiting = await countActiveWaiting(userId, client);
  const { rows } = await client.query(
    `SELECT
       (SELECT COUNT(*)::int FROM send_queue_entries sq
        INNER JOIN applications a ON a.id = sq.application_id AND a.user_id = sq.user_id
        WHERE sq.user_id = $1 AND sq.status = $2 AND sq.created_at >= $3
          AND a.application_status NOT IN ('sent', 'failed')) AS queued_today,
       (SELECT COUNT(*)::int FROM applications
        WHERE user_id = $1 AND application_status = 'sent' AND sent_at >= $3) AS sent_today,
       (SELECT COUNT(*)::int FROM applications
        WHERE user_id = $1 AND application_status = 'failed' AND updated_at >= $3) AS failed_today`,
    [userId, SEND_QUEUE_ENTRY_STATUS.WAITING, dayStart]
  );
  const row = rows[0] ?? { queued_today: 0, sent_today: 0, failed_today: 0 };
  return {
    queued_today: row.queued_today,
    queued_count: activeWaiting,
    sent_today: row.sent_today,
    failed_today: row.failed_today,
  };
}

module.exports = {
  insertQueueEntry,
  getQueueEntryByApplicationId,
  countWaiting,
  listWaitingOrdered,
  getHeadWaitingForUpdate,
  updateQueueEntryStatus,
  clearWaitingEstimates,
  setWaitingEstimate,
  getScheduler,
  ensureScheduler,
  updateScheduler,
  findOverdueActiveSchedulers,
  getDailySummaryCounts,
  countActiveWaiting,
  reconcileOrphanedQueueEntries,
  startOfUtcDay,
};
