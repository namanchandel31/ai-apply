const { pool } = require("../db");
const entitlementService = require("./entitlementService");
const settingsService = require("./settingsService");
const usageCounterModel = require("../models/usageCounterModel");
const { FEATURE_KEYS } = require("../constants/featureKeys");

function isUnlimited(limit) {
  return limit === null || limit === undefined || Number(limit) < 0;
}

async function getBaseApplicationLimit(userId) {
  const ent = await entitlementService.getEntitlement(userId);
  if (!ent.paywallEnabled) return -1;
  if ((await settingsService.getTrialMode()) === "time") return -1;
  return ent.entitlements[FEATURE_KEYS.QUOTA_APPLICATIONS_SENT];
}

async function getReferralBonusTotal(userId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(applications_granted), 0)::int AS total
     FROM referral_rewards
     WHERE referrer_user_id = $1`,
    [userId]
  );
  return Number(rows[0]?.total || 0);
}

async function getAdminBonusTotal(userId) {
  const adminUserModel = require("../models/adminUserModel");
  return adminUserModel.getAdminBonusTotal(userId);
}

async function getEffectiveApplicationLimit(userId) {
  const baseLimit = await getBaseApplicationLimit(userId);
  if (isUnlimited(baseLimit)) {
    return { unlimited: true, limit: -1, baseLimit: -1, bonusLimit: 0, adminBonus: 0, referralBonus: 0 };
  }
  const referralBonus = await getReferralBonusTotal(userId);
  const adminBonus = await getAdminBonusTotal(userId);
  const bonusLimit = referralBonus + adminBonus;
  const numericBase = Number(baseLimit);
  return {
    unlimited: false,
    limit: numericBase + bonusLimit,
    baseLimit: numericBase,
    bonusLimit,
    referralBonus,
    adminBonus,
  };
}

async function checkApplicationQuota(userId) {
  const effective = await getEffectiveApplicationLimit(userId);
  if (effective.unlimited) {
    return {
      allowed: true,
      unlimited: true,
      limit: -1,
      used: 0,
      remaining: Infinity,
      baseLimit: -1,
      bonusLimit: 0,
      periodType: "lifetime",
    };
  }
  const used = await usageCounterModel.getUsage(
    userId,
    FEATURE_KEYS.QUOTA_APPLICATIONS_SENT,
    "lifetime"
  );
  const limit = effective.limit;
  const remaining = Math.max(0, limit - used);
  return {
    allowed: used < limit,
    unlimited: false,
    limit,
    used,
    remaining,
    baseLimit: effective.baseLimit,
    bonusLimit: effective.bonusLimit,
    periodType: "lifetime",
  };
}

module.exports = {
  getReferralBonusTotal,
  getEffectiveApplicationLimit,
  checkApplicationQuota,
};
