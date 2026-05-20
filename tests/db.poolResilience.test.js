const EventEmitter = require("events");

jest.mock("../src/utils/logger", () => ({
  logger: {
    error: jest.fn(),
    fatal: jest.fn(),
  },
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

const config = require("../src/config");
const { logger } = require("../src/utils/logger");
const { buildPoolConfig, attachPoolErrorHandler } = require("../src/db");
const { isTransientPgError } = require("../src/utils/pgErrors");

describe("buildPoolConfig", () => {
  it("returns pool sizing defaults wired from database config", () => {
    const poolConfig = buildPoolConfig();
    expect(poolConfig.max).toBe(10);
    expect(poolConfig.idleTimeoutMillis).toBe(30000);
    expect(poolConfig.connectionTimeoutMillis).toBe(10000);
    expect(poolConfig.keepAlive).toBe(true);
    expect(poolConfig.connectionString).toBe(config.database.databaseUrl);
    expect(poolConfig.ssl).toBe(config.database.ssl);
  });
});

describe("attachPoolErrorHandler", () => {
  it("logs PG_POOL_ERROR without throwing when pool emits error", () => {
    const fakePool = new EventEmitter();
    attachPoolErrorHandler(fakePool);

    const err = Object.assign(new Error("Connection terminated unexpectedly"), {
      code: "ECONNRESET",
    });

    expect(() => fakePool.emit("error", err)).not.toThrow();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "PG_POOL_ERROR",
        err,
        error_type: "Error",
        error_message: "Connection terminated unexpectedly",
      }),
      "Unexpected error on idle PostgreSQL client"
    );
  });
});

describe("isTransientPgError", () => {
  it("detects ECONNRESET, ETIMEDOUT, and 08006", () => {
    expect(isTransientPgError({ code: "ECONNRESET" })).toBe(true);
    expect(isTransientPgError({ code: "ETIMEDOUT" })).toBe(true);
    expect(isTransientPgError({ code: "08006" })).toBe(true);
  });

  it("detects connection terminated unexpectedly in message", () => {
    expect(
      isTransientPgError(new Error("connection terminated unexpectedly"))
    ).toBe(true);
  });

  it("returns false for generic errors", () => {
    expect(isTransientPgError(new Error("syntax error"))).toBe(false);
    expect(isTransientPgError({ code: "23505" })).toBe(false);
  });
});
