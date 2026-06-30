const { PostHog } = require("posthog-node");

const apiKey = process.env.POSTHOG_API_KEY;
const host = process.env.POSTHOG_HOST || "https://eu.i.posthog.com";

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

function capture(distinctId, event, properties = {}) {
  const client = getPostHogClient();
  if (!client) return;
  client.capture({ distinctId, event, properties });
}

async function shutdown() {
  if (_client) {
    await _client.shutdown();
    _client = null;
  }
}

module.exports = { getPostHogClient, capture, shutdown };
