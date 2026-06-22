const { ok, error, ERROR_CODES } = require("../utils/response");
const { logError } = require("../utils/logger");
const referralService = require("../services/referralService");
const settingsService = require("../services/settingsService");

async function getReferralSummaryController(req, res) {
  try {
    const summary = await referralService.getUserReferralSummary(req.user.id);
    return ok(res, summary);
  } catch (err) {
    logError("REFERRAL_SUMMARY_ERROR", err, { userId: req.user.id });
    return error(res, 500, err.message, ERROR_CODES.INTERNAL_ERROR);
  }
}

async function attachReferralController(req, res) {
  try {
    const referralCode = req.body?.referralCode;
    const attached = await referralService.attachReferralOnSignup(req.user.id, referralCode);
    return ok(res, { attached: !!attached });
  } catch (err) {
    logError("REFERRAL_ATTACH_ERROR", err, { userId: req.user.id });
    return error(res, 500, err.message, ERROR_CODES.INTERNAL_ERROR);
  }
}

async function getAdminReferralStatsController(req, res) {
  try {
    const stats = await referralService.getReferralStats();
    const settings = await referralService.getReferralSettings();
    return ok(res, { stats, settings });
  } catch (err) {
    logError("ADMIN_REFERRAL_STATS_ERROR", err, { reqId: req.requestId });
    return error(res, 500, err.message, ERROR_CODES.INTERNAL_ERROR);
  }
}

async function updateReferralSettingsController(req, res) {
  try {
    const keys = [
      "referral_program_enabled",
      "referral_reward_applications",
      "referral_required_successful_applications",
      "referral_max_rewards_per_user",
      "referral_completion_window_hours",
    ];
    for (const key of keys) {
      if (req.body[key] !== undefined) {
        await settingsService.updateSetting(key, req.body[key], req.user.id);
      }
    }
    const settings = await referralService.getReferralSettings();
    return ok(res, { settings });
  } catch (err) {
    logError("ADMIN_REFERRAL_SETTINGS_ERROR", err, { reqId: req.requestId });
    return error(res, 500, err.message, ERROR_CODES.INTERNAL_ERROR);
  }
}

async function getReferralListController(req, res) {
  try {
    const referrals = await referralService.getUserReferrals(req.user.id);
    return ok(res, { referrals });
  } catch (err) {
    logError("REFERRAL_LIST_ERROR", err, { userId: req.user.id });
    return error(res, 500, err.message, ERROR_CODES.INTERNAL_ERROR);
  }
}

module.exports = {
  getReferralSummaryController,
  getReferralListController,
  attachReferralController,
  getAdminReferralStatsController,
  updateReferralSettingsController,
};
