const { bool } = require("./env");

/** When true, refuse API boot if another API pid owns SSE. */
const strictSingleApi = bool("RUNTIME_STRICT_SINGLE_API", false);

module.exports = {
  strictSingleApi,
};
