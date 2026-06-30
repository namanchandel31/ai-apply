const https = require("https");
const { URL } = require("url");

const POSTHOG_HOST = (process.env.POSTHOG_HOST || "https://eu.i.posthog.com").replace(/\/$/, "");

/**
 * Reverse-proxy PostHog ingest (mount with express.raw on /ingest).
 */
function posthogIngestProxy(req, res) {
  const suffix = req.url.replace(/^\/ingest/, "") || "/";
  const target = new URL(suffix, `${POSTHOG_HOST}/`);

  const headers = { ...req.headers, host: target.host };
  delete headers.connection;

  const options = {
    hostname: target.hostname,
    port: target.port || 443,
    path: `${target.pathname}${target.search}`,
    method: req.method,
    headers,
  };

  const proxyReq = https.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode || 502);
    Object.entries(proxyRes.headers).forEach(([key, value]) => {
      if (value !== undefined) res.setHeader(key, value);
    });
    proxyRes.pipe(res);
  });

  proxyReq.on("error", () => {
    res.status(502).json({ success: false, error: "PostHog ingest proxy failed" });
  });

  if (req.body && Buffer.isBuffer(req.body) && req.body.length > 0) {
    proxyReq.write(req.body);
  }
  proxyReq.end();
}

module.exports = { posthogIngestProxy };
