const { csv, str } = require("./env");

/** Comma-separated allowed browser origins (e.g. https://app.vercel.app). Empty = reflect request Origin. */
const allowedOrigins = csv("CORS_ORIGIN");

function buildCorsMiddlewareOptions() {
  const allowedHeaders = [
    "Authorization",
    "Content-Type",
    "If-None-Match",
    "Last-Event-ID",
    "x-internal-api-key",
  ];

  if (allowedOrigins.length === 0) {
    return {
      origin: true,
      credentials: true,
      allowedHeaders,
      exposedHeaders: ["ETag", "X-Replay-Status"],
    };
  }

  const originSet = new Set(allowedOrigins);

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (originSet.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
    allowedHeaders,
    exposedHeaders: ["ETag", "X-Replay-Status"],
  };
}

module.exports = {
  allowedOrigins,
  buildCorsMiddlewareOptions,
  corsOriginEnv: str("CORS_ORIGIN", ""),
};
