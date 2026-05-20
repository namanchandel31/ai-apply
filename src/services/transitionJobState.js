const { logInfo } = require("../utils/logger");
const {
  scheduleApplicationRealtimePublish,
} = require("./applicationRealtimePublisher");

function normalizeExpected(expectedStatus) {
  return Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
}

async function transitionJobState(client, params) {
  const {
    jobId,
    expectedStatus,
    nextStatus,
    lastError = undefined,
    patch = {},
  } = params;

  const expected = normalizeExpected(expectedStatus);
  const sets = ["status = $2", "updated_at = NOW()"];
  const values = [jobId, nextStatus];
  let idx = 3;

  if (nextStatus === "processing") {
    sets.push("started_at = COALESCE(started_at, NOW())");
  }
  if (nextStatus === "completed" || nextStatus === "failed") {
    sets.push("completed_at = COALESCE(completed_at, NOW())");
  }
  if (lastError !== undefined) {
    sets.push(`last_error = $${idx}`);
    values.push(lastError);
    idx += 1;
  }
  if (patch.bullmqJobId) {
    sets.push(`bullmq_job_id = $${idx}`);
    values.push(patch.bullmqJobId);
    idx += 1;
  }
  if (patch.retryCountIncrement) {
    sets.push("retry_count = retry_count + 1");
  }

  const sql = `
    UPDATE application_jobs
    SET ${sets.join(", ")}
    WHERE id = $1 AND status = ANY($${idx}::text[])
    RETURNING *
  `;
  values.push(expected);
  const { rows } = await client.query(sql, values);

  if (!rows.length) {
    const cur = await client.query(`SELECT status FROM application_jobs WHERE id = $1`, [jobId]);
    logInfo("job_state_transition_conflict", {
      jobId,
      expected,
      nextStatus,
      currentStatus: cur.rows[0]?.status,
    });
    return { ok: false, conflict: true, currentStatus: cur.rows[0]?.status };
  }

  const row = rows[0];
  if (row.application_id) {
    client
      .query(`SELECT user_id FROM applications WHERE id = $1`, [row.application_id])
      .then(({ rows: appRows }) => {
        const userId = appRows[0]?.user_id;
        if (userId) {
          scheduleApplicationRealtimePublish(row.application_id, userId);
        }
      })
      .catch(() => {});
  }
  return { ok: true, row };
}

module.exports = { transitionJobState };
