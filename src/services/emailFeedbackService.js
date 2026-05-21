const { pool } = require("../db");

function initialEmailFeedbackSignals() {
  return {
    manuallyEdited: null,
    recruiterReply: null,
    ignored: null,
    bounced: null,
    regenerated: null,
    userRewritten: null,
    responseLatencyMs: null,
  };
}

/**
 * Stub for future engagement tracking — merges partial signals into JSONB column.
 */
async function recordEmailFeedback(applicationId, partialSignals, userId = null) {
  const allowed = Object.keys(initialEmailFeedbackSignals());
  const patch = {};
  for (const [key, val] of Object.entries(partialSignals || {})) {
    if (allowed.includes(key)) patch[key] = val;
  }
  if (!Object.keys(patch).length) return null;

  const query = userId
    ? `UPDATE applications SET email_feedback_signals = COALESCE(email_feedback_signals, '{}'::jsonb) || $2::jsonb, updated_at = NOW()
       WHERE id = $1 AND user_id = $3 RETURNING email_feedback_signals`
    : `UPDATE applications SET email_feedback_signals = COALESCE(email_feedback_signals, '{}'::jsonb) || $2::jsonb, updated_at = NOW()
       WHERE id = $1 RETURNING email_feedback_signals`;

  const params = userId
    ? [applicationId, JSON.stringify(patch), userId]
    : [applicationId, JSON.stringify(patch)];

  const { rows } = await pool.query(query, params);
  return rows[0]?.email_feedback_signals ?? null;
}

module.exports = {
  initialEmailFeedbackSignals,
  recordEmailFeedback,
};
