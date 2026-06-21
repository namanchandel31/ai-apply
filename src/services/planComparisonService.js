const planModel = require("../models/planModel");
const featureDefinitionModel = require("../models/featureDefinitionModel");

/**
 * Diffs two plans into gains / losses / limit_changes for admin preview and
 * user-facing upgrade/downgrade screens. Generated entirely from the catalog +
 * plan entitlements; no hardcoded messaging.
 */
async function compare(fromPlanId, toPlanId) {
  const [fromMap, toMap, features] = await Promise.all([
    fromPlanId ? planModel.resolveEntitlementMap(fromPlanId) : planModel.resolveDefaultEntitlementMap(),
    planModel.resolveEntitlementMap(toPlanId),
    featureDefinitionModel.listFeatures({ includeInactive: false }),
  ]);

  const byKey = new Map(features.map((f) => [f.key, f]));
  const gains = [];
  const losses = [];
  const limit_changes = [];
  const changes = [];

  for (const f of features) {
    const oldVal = fromMap[f.key];
    const newVal = toMap[f.key];
    const label = f.displayName || f.key;

    if (f.type === "boolean") {
      if (newVal === true && oldVal !== true) gains.push({ key: f.key, label });
      else if (oldVal === true && newVal !== true) losses.push({ key: f.key, label });
    } else if (f.type === "number") {
      const o = Number(oldVal ?? 0);
      const n = Number(newVal ?? 0);
      if (o !== n) {
        limit_changes.push({
          feature: f.key,
          label,
          old: o,
          new: n,
          direction: n > o ? "increase" : "decrease",
        });
      }
    } else {
      if (oldVal !== newVal) {
        changes.push({ key: f.key, label, old: oldVal ?? null, new: newVal ?? null });
      }
    }
  }

  // Heuristic direction: more gains than losses => upgrade.
  let direction = "lateral";
  const upScore = gains.length + limit_changes.filter((c) => c.direction === "increase").length;
  const downScore = losses.length + limit_changes.filter((c) => c.direction === "decrease").length;
  if (upScore > downScore) direction = "upgrade";
  else if (downScore > upScore) direction = "downgrade";

  return { direction, gains, losses, limit_changes, changes };
}

module.exports = { compare };
