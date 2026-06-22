const { pool } = require("../db");
const { ok, error, ERROR_CODES } = require("../utils/response");
const { logError } = require("../utils/logger");

async function getAiCostMetricsController(req, res) {
  try {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 30));
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);

    const { rows: byModel } = await pool.query(
      `SELECT
         credential_source,
         provider,
         model,
         COUNT(*)::int AS request_count,
         COUNT(*) FILTER (WHERE success)::int AS success_count,
         COALESCE(SUM(estimated_cost), 0)::numeric AS total_cost,
         COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens
       FROM llm_usage_logs
       WHERE created_at >= $1
       GROUP BY credential_source, provider, model
       ORDER BY total_cost DESC NULLS LAST`,
      [since]
    );

    const { rows: daily } = await pool.query(
      `SELECT
         DATE(created_at) AS day,
         credential_source,
         COALESCE(SUM(estimated_cost), 0)::numeric AS total_cost,
         COUNT(*)::int AS requests
       FROM llm_usage_logs
       WHERE created_at >= $1
       GROUP BY DATE(created_at), credential_source
       ORDER BY day ASC`,
      [since]
    );

    const { rows: byCredential } = await pool.query(
      `SELECT
         pc.id AS credential_id,
         pc.label,
         pc.provider,
         COUNT(l.*)::int AS request_count,
         COALESCE(SUM(l.estimated_cost), 0)::numeric AS total_cost
       FROM llm_usage_logs l
       JOIN platform_ai_credentials pc ON pc.id = l.platform_credential_id
       WHERE l.created_at >= $1 AND l.credential_source = 'platform'
       GROUP BY pc.id, pc.label, pc.provider
       ORDER BY total_cost DESC NULLS LAST`,
      [since]
    );

    const platformTotal = byModel
      .filter((r) => r.credential_source === "platform")
      .reduce((sum, r) => sum + Number(r.total_cost || 0), 0);
    const byokTotal = byModel
      .filter((r) => r.credential_source === "user")
      .reduce((sum, r) => sum + Number(r.total_cost || 0), 0);

    return ok(res, {
      since: since.toISOString(),
      days,
      totals: { platformCost: platformTotal, byokEstimatedCost: byokTotal },
      byModel,
      daily,
      byPlatformCredential: byCredential,
    });
  } catch (err) {
    logError("ADMIN_AI_COST_ERROR", err, { reqId: req.requestId });
    return error(res, 500, err.message, ERROR_CODES.INTERNAL_ERROR);
  }
}

module.exports = { getAiCostMetricsController };
