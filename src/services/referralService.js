const crypto = require("crypto");
const { pool } = require("../db");
const settingsService = require("./settingsService");
const trialLimitService = require("./trialLimitService");
const quotaConsumptionModel = require("../models/quotaConsumptionModel");
const usageCounterModel = require("../models/usageCounterModel");
const { FEATURE_KEYS } = require("../constants/featureKeys");
const { logError, logInfo } = require("../utils/logger");

const FEATURE_KEY = FEATURE_KEYS.QUOTA_APPLICATIONS_SENT;
const PERIOD = "lifetime";

async function getReferralSettings() {
  const settings = await settingsService.loadSettings();
  return {
    enabled: settings.referral_program_enabled !== false,
    rewardApplications: Number(settings.referral_reward_applications) || 10,
    requiredSends: Number(settings.referral_required_successful_applications) || 1,
    maxRewardsPerUser: Number(settings.referral_max_rewards_per_user) || 5,
    completionWindowHours: Number(settings.referral_completion_window_hours) || 24,
  };
}

async function ensureReferralCode(userId) {
  const { rows } = await pool.query(`SELECT referral_code FROM users WHERE id = $1`, [userId]);
  if (rows[0]?.referral_code) return rows[0].referral_code;
  const code = crypto.randomBytes(4).toString("hex").toUpperCase();
  const { rows: updated } = await pool.query(
    `UPDATE users SET referral_code = $2 WHERE id = $1 AND referral_code IS NULL RETURNING referral_code`,
    [userId, code]
  );
  return updated[0]?.referral_code || code;
}

async function attachReferralOnSignup(referredUserId, referralCode) {
  if (!referralCode) return null;
  const settings = await getReferralSettings();
  if (!settings.enabled) return null;

  const { rows: referrers } = await pool.query(
    `SELECT id FROM users WHERE referral_code = $1 LIMIT 1`,
    [String(referralCode).trim().toUpperCase()]
  );
  const referrerUserId = referrers[0]?.id;
  if (!referrerUserId || referrerUserId === referredUserId) return null;

  const expiresAt = new Date(Date.now() + settings.completionWindowHours * 3600 * 1000);
  const { rows } = await pool.query(
    `INSERT INTO referrals (referrer_user_id, referred_user_id, referral_code, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (referred_user_id) DO NOTHING
     RETURNING *`,
    [referrerUserId, referredUserId, String(referralCode).trim().toUpperCase(), expiresAt]
  );
  return rows[0] || null;
}

async function countCompletedRewards(referrerUserId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM referral_rewards WHERE referrer_user_id = $1`,
    [referrerUserId]
  );
  return Number(rows[0]?.count || 0);
}

async function recordSuccessfulSendForReferral(referredUserId) {
  const settings = await getReferralSettings();
  if (!settings.enabled) return;

  const { rows } = await pool.query(
    `SELECT * FROM referrals
     WHERE referred_user_id = $1 AND status = 'pending'
     LIMIT 1`,
    [referredUserId]
  );
  const referral = rows[0];
  if (!referral) return;

  if (new Date(referral.expires_at) < new Date()) {
    await pool.query(`UPDATE referrals SET status = 'expired' WHERE id = $1`, [referral.id]);
    return;
  }

  const { rows: updated } = await pool.query(
    `UPDATE referrals
     SET successful_send_count = successful_send_count + 1
     WHERE id = $1
     RETURNING *`,
    [referral.id]
  );
  const row = updated[0];
  if (!row || row.successful_send_count < settings.requiredSends) return;

  const rewardCount = await countCompletedRewards(referral.referrer_user_id);
  if (rewardCount >= settings.maxRewardsPerUser) {
    await pool.query(`UPDATE referrals SET status = 'rejected' WHERE id = $1`, [referral.id]);
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE referrals SET status = 'completed', completed_at = NOW() WHERE id = $1 AND status = 'pending'`,
      [referral.id]
    );
    await client.query(
      `INSERT INTO referral_rewards (referral_id, referrer_user_id, applications_granted)
       VALUES ($1, $2, $3)
       ON CONFLICT (referral_id) DO NOTHING`,
      [referral.id, referral.referrer_user_id, settings.rewardApplications]
    );
    await client.query("COMMIT");
    logInfo("referral_reward_granted", {
      referralId: referral.id,
      referrerUserId: referral.referrer_user_id,
      applicationsGranted: settings.rewardApplications,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    logError("REFERRAL_REWARD_FAILED", err, { referralId: referral.id });
  } finally {
    client.release();
  }
}

async function expireStaleReferrals() {
  const { rowCount } = await pool.query(
    `UPDATE referrals SET status = 'expired'
     WHERE status = 'pending' AND expires_at < NOW()`
  );
  return rowCount;
}

async function getReferralStats() {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
       COUNT(*) FILTER (WHERE status = 'expired')::int AS expired,
       COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
     FROM referrals`
  );
  const bonus = await pool.query(
    `SELECT COALESCE(SUM(applications_granted), 0)::int AS granted FROM referral_rewards`
  );
  return {
    ...rows[0],
    bonusApplicationsGranted: Number(bonus.rows[0]?.granted || 0),
  };
}

async function getUserReferralSummary(userId) {
  const code = await ensureReferralCode(userId);
  const rewardsGranted = await countCompletedRewards(userId);
  const settings = await getReferralSettings();
  const bonusTotal = await trialLimitService.getReferralBonusTotal(userId);
  return {
    referralCode: code,
    rewardsGranted,
    maxRewards: settings.maxRewardsPerUser,
    rewardApplications: settings.rewardApplications,
    requiredSends: settings.requiredSends,
    completionWindowHours: settings.completionWindowHours,
    bonusApplicationsTotal: bonusTotal,
    programEnabled: settings.enabled,
    canEarnMore: rewardsGranted < settings.maxRewardsPerUser && settings.enabled,
  };
}

function maskReferralEmail(email) {
  if (!email || typeof email !== "string") return "Friend";
  const [local, domain] = email.split("@");
  if (!local || !domain) return "Friend";
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

function displayReferredUser(row) {
  if (row.referred_first_name?.trim()) return row.referred_first_name.trim();
  if (row.referred_full_name?.trim()) return row.referred_full_name.trim().split(/\s+/)[0];
  return maskReferralEmail(row.referred_email);
}

async function getUserReferrals(userId) {
  const { rows } = await pool.query(
    `SELECT r.id,
            r.status,
            r.created_at,
            r.completed_at,
            r.expires_at,
            r.successful_send_count,
            rr.applications_granted,
            u.email AS referred_email,
            u.full_name AS referred_full_name,
            u.first_name AS referred_first_name
     FROM referrals r
     JOIN users u ON u.id = r.referred_user_id
     LEFT JOIN referral_rewards rr ON rr.referral_id = r.id
     WHERE r.referrer_user_id = $1
     ORDER BY r.created_at DESC`,
    [userId]
  );

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    displayName: displayReferredUser(row),
    successfulSendCount: Number(row.successful_send_count || 0),
    applicationsGranted: row.applications_granted == null ? null : Number(row.applications_granted),
    createdAt: row.created_at,
    completedAt: row.completed_at,
    expiresAt: row.expires_at,
  }));
}

/**
 * Post-send idempotent quota consume. Never throws — logs reconciliation on failure.
 */
async function consumeApplicationQuotaAfterSend({ userId, applicationId }) {
  try {
    const already = await quotaConsumptionModel.hasConsumed(applicationId);
    if (already) return { consumed: true, skipped: true };

    const effective = await trialLimitService.getEffectiveApplicationLimit(userId);
    if (effective.unlimited) {
      await quotaConsumptionModel.recordConsumption(applicationId, userId, FEATURE_KEY);
      return { consumed: true, unlimited: true };
    }

    const used = await usageCounterModel.consumeIfWithinLimit(
      userId,
      FEATURE_KEY,
      PERIOD,
      1,
      effective.limit
    );

    if (used === null) {
      await quotaConsumptionModel.recordReconciliation({
        applicationId,
        userId,
        eventType: "consume_skipped_limit",
        details: { effectiveLimit: effective.limit },
      });
      logInfo("quota_consume_skipped_limit", { userId, applicationId });
      return { consumed: false, reason: "limit" };
    }

    await quotaConsumptionModel.recordConsumption(applicationId, userId, FEATURE_KEY);
    return { consumed: true, used };
  } catch (err) {
    logError("quota_consume_failed", err, { userId, applicationId });
    try {
      await quotaConsumptionModel.recordReconciliation({
        applicationId,
        userId,
        eventType: "consume_failed",
        details: { message: err.message },
      });
    } catch (reconcileErr) {
      logError("quota_reconciliation_log_failed", reconcileErr, { userId, applicationId });
    }
    return { consumed: false, reason: "error" };
  }
}

async function retryFailedQuotaConsumptions() {
  const pending = await quotaConsumptionModel.listFailedConsumptions(50);
  let retried = 0;
  for (const row of pending) {
    const result = await consumeApplicationQuotaAfterSend({
      userId: row.user_id,
      applicationId: row.application_id,
    });
    if (result.consumed) retried += 1;
  }
  if (pending.length > 0) {
    logInfo("quota_reconciliation_retry_batch", { attempted: pending.length, retried });
  }
  return { attempted: pending.length, retried };
}

module.exports = {
  getReferralSettings,
  ensureReferralCode,
  attachReferralOnSignup,
  recordSuccessfulSendForReferral,
  expireStaleReferrals,
  retryFailedQuotaConsumptions,
  getReferralStats,
  getUserReferralSummary,
  getUserReferrals,
  consumeApplicationQuotaAfterSend,
};
