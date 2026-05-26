/**
 * Sole module that reads process.env for application config.
 * Scripts/tests may set env before requiring src/config.
 */

const DEBUG_SCOPES_ALLOWLIST = new Set(["orchestration", "query", "llm"]);

function str(key, fallback) {
  const v = process.env[key];
  if (v == null || String(v).trim() === "") return fallback;
  return String(v).trim();
}

function bool(key, fallback = false) {
  const v = process.env[key];
  if (v == null || String(v).trim() === "") return fallback;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

function int(key, fallback) {
  const v = process.env[key];
  if (v == null || String(v).trim() === "") return fallback;
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
}

function csv(key) {
  const raw = str(key, "");
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function parseDebugScopes() {
  const scopes = csv("DEBUG");
  const valid = new Set();
  const unknown = [];
  for (const s of scopes) {
    if (DEBUG_SCOPES_ALLOWLIST.has(s)) valid.add(s);
    else unknown.push(s);
  }
  if (unknown.length && process.env.NODE_ENV !== "test") {
    // eslint-disable-next-line no-console
    console.warn(
      `[config] Ignoring unknown DEBUG scopes: ${unknown.join(", ")}. Allowlist: orchestration, query, llm`
    );
  }
  return valid;
}

function requireEnv(keys, { exitOnMissing = true } = {}) {
  const missing = keys.filter((k) => !str(k, null));
  if (missing.length && exitOnMissing) {
    // eslint-disable-next-line no-console
    console.error("Missing required environment variables:");
    missing.forEach((k) => console.error(`  - ${k}`));
    process.exit(1);
  }
  return missing;
}

function validateStartup() {
  const isTest = process.env.NODE_ENV === "test";
  const isProduction = process.env.NODE_ENV === "production";

  if (isTest) return;

  const required = [
    "DATABASE_URL",
    "REDIS_URL",
    "INTERNAL_API_KEY",
    "ENCRYPTION_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];

  requireEnv(required);

  const redisUrl = str("REDIS_URL", null);
  if (redisUrl && !/^redis(s)?:\/\//i.test(redisUrl)) {
    // eslint-disable-next-line no-console
    console.error(
      "[config] REDIS_URL must be a redis:// or rediss:// connection string (required for BullMQ queues)"
    );
    process.exit(1);
  }

  const { assertQueueConfiguration } = require("../constants/queues");
  assertQueueConfiguration();

  if (!isProduction && !str("OPENAI_API_KEY", null)) {
    // eslint-disable-next-line no-console
    console.warn("[config] OPENAI_API_KEY is not set — AI features will be limited");
  }
}

module.exports = {
  str,
  bool,
  int,
  csv,
  parseDebugScopes,
  requireEnv,
  validateStartup,
  DEBUG_SCOPES_ALLOWLIST,
};
