const { PostHog } = require("posthog-node");

const apiKey = process.env.POSTHOG_API_KEY;
const host = process.env.POSTHOG_HOST || "https://eu.i.posthog.com";
const appVersion = process.env.npm_package_version || "1.0.0";

let _client = null;

function getPostHogClient() {
  if (!_client) {
    if (!apiKey) {
      return null;
    }
    _client = new PostHog(apiKey, { host });
  }
  return _client;
}

function baseProperties(tier, extra = {}) {
  return {
    event_tier: tier,
    app_version: appVersion,
    environment: process.env.NODE_ENV === "production" ? "production" : "development",
    platform: "web",
    authenticated: true,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

function capture(distinctId, event, properties = {}) {
  const client = getPostHogClient();
  if (!client || !distinctId) return;
  client.capture({ distinctId: String(distinctId), event, properties });
}

function captureTier(distinctId, event, tier, properties = {}) {
  capture(distinctId, event, baseProperties(tier, properties));
}

function captureBusiness(distinctId, event, properties = {}, schemaVersion = 1) {
  captureTier(distinctId, event, "business", { schema_version: schemaVersion, ...properties });
}

function captureProduct(distinctId, event, properties = {}) {
  captureTier(distinctId, event, "product", properties);
}

function captureOperational(distinctId, event, properties = {}) {
  captureTier(distinctId, event, "operational", properties);
}

function identifyUser(distinctId, traits = {}) {
  const client = getPostHogClient();
  if (!client || !distinctId) return;
  client.identify({ distinctId: String(distinctId), properties: traits });
}

function getWorkflowId(req) {
  const header = req?.headers?.["x-workflow-id"] || req?.headers?.["X-Workflow-Id"];
  return typeof header === "string" && header.trim() ? header.trim() : undefined;
}

function getRequestMeta(req) {
  return {
    request_id: req?.requestId || undefined,
    workflow_id: getWorkflowId(req),
  };
}

async function shutdown() {
  if (_client) {
    await _client.shutdown();
    _client = null;
  }
}

module.exports = {
  getPostHogClient,
  capture,
  captureBusiness,
  captureProduct,
  captureOperational,
  identifyUser,
  getWorkflowId,
  getRequestMeta,
  shutdown,
};
