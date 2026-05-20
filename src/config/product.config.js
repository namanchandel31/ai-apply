const { int } = require("./env");

module.exports = {
  autoApplyHourlyLimit: int("AUTO_APPLY_HOURLY_LIMIT", 10),
  autoApplyDailyLimit: int("AUTO_APPLY_DAILY_LIMIT", 50),
};
