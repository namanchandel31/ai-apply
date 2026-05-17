const request = require("supertest");
const fs = require("fs");
const path = require("path");

// Prevent DB connection on app import in test
jest.mock("../src/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
  testConnection: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../src/models/applicationModel", () => ({
  recoverStaleProcessing: jest.fn().mockResolvedValue([]),
}));

const app = require("../index");

describe("static routes & SPA fallback integration", () => {
  const publicDir = path.join(__dirname, "..", "public");

  it("GET /health returns JSON (not intercepted by SPA fallback)", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
  });

  it("GET / serves index.html for SPA entry", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("root");
  });

  it("GET /missing-asset.js returns 404 (not SPA index.html)", async () => {
    const res = await request(app).get("/assets/this-file-does-not-exist-xyz.js");
    expect(res.status).toBe(404);
    // Must not serve the React SPA shell (would be 200 with id="root")
    expect(res.text).not.toContain('id="root"');
    expect(res.text).not.toContain("AI Apply");
  });

  it("GET /api/upload-resume without auth returns 401 (not index.html)", async () => {
    const res = await request(app).post("/api/upload-resume");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("success", false);
  });

  it("serves an existing built asset when present", async () => {
    const assetsDir = path.join(publicDir, "assets");
    if (!fs.existsSync(assetsDir)) {
      return; // skip if UI not built
    }
    const files = fs.readdirSync(assetsDir).filter((f) => f.endsWith(".js"));
    if (files.length === 0) return;

    const res = await request(app).get(`/assets/${files[0]}`);
    expect(res.status).toBe(200);
  });
});
