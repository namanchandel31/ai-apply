/** @typedef {'realtime'|'reconciliation'|'hydration'|'transport'|'leader'|'poll'} OrchestrationComponent */

const logging = require("../config/logging.config");

/**
 * All orchestration sub-components map to DEBUG scope "orchestration".
 * @param {OrchestrationComponent} _component
 */
function isDebugEnabled(_component) {
  if (logging.isOrchestrationDebugEnabled(_component)) return true;
  return logging.logLevel === "debug";
}

module.exports = { isDebugEnabled };
