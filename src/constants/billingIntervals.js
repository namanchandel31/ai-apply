const BILLING_INTERVALS = {
  week: { label: "Weekly", durationDays: 7, interval: "week" },
  month: { label: "Monthly", durationDays: 30, interval: "month" },
  quarter: { label: "Quarterly", durationDays: 90, interval: "quarter" },
  year: { label: "Yearly", durationDays: 365, interval: "year" },
  custom: { label: "Custom", durationDays: null, interval: "custom" },
};

const INTERVAL_PRESETS = Object.keys(BILLING_INTERVALS);

function resolveIntervalPreset(interval, durationDays) {
  if (interval && BILLING_INTERVALS[interval] && interval !== "custom") {
    return BILLING_INTERVALS[interval];
  }
  const match = INTERVAL_PRESETS.find((key) => {
    if (key === "custom") return false;
    return BILLING_INTERVALS[key].durationDays === durationDays;
  });
  if (match) return BILLING_INTERVALS[match];
  return { label: durationDays ? `${durationDays} days` : "Custom", durationDays, interval: interval || "custom" };
}

module.exports = { BILLING_INTERVALS, INTERVAL_PRESETS, resolveIntervalPreset };
