const request = require("supertest");

jest.mock("../src/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn(), end: jest.fn() },
  testConnection: jest.fn().mockResolvedValue(undefined),
  startPoolMetricsLogging: jest.fn(),
  POOL_INSTANCE_ID: "test-pool",
}));

jest.mock("../src/jobs/recovery.job", () => ({
  recoveryLoop: jest.fn(),
}));

jest.mock("../src/queues/validateQueueSystem", () => ({
  validateQueueSystem: jest.fn().mockResolvedValue(undefined),
}));

const app = require("../index");

describe("API routes (no static frontend)", () => {
  it("GET /health returns JSON", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
  });

  it("GET / does not serve SPA shell", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(404);
  });

  it("GET /api/upload-resume without auth returns 401", async () => {
    const res = await request(app).post("/api/upload-resume");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("success", false);
  });
});
