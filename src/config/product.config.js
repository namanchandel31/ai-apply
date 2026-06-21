const { bool, int } = require("./env");

module.exports = {
  autoApplyHourlyLimit: int("AUTO_APPLY_HOURLY_LIMIT", 10),
  autoApplyDailyLimit: int("AUTO_APPLY_DAILY_LIMIT", 50),
  /** When false, treat all users as subscribed (no paywall). */
  pricingEnabled: bool("PRICING_ENABLED", true),
};
