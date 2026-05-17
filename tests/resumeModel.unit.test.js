const { findResumeByHash } = require("../src/models/resumeModel");

jest.mock("../src/db", () => ({
  pool: { query: jest.fn() },
}));

jest.mock("../src/utils/logger", () => ({
  logError: jest.fn(),
}));

const { pool } = require("../src/db");

describe("findResumeByHash", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses alias r consistently in SQL (no undefined r in FROM)", async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await findResumeByHash("abc123", "user-uuid-1");

    const sql = pool.query.mock.calls[0][0];
    expect(sql).toMatch(/FROM resumes r/i);
    expect(sql).toMatch(/r\.file_hash/i);
    expect(sql).toMatch(/r\.file_path/i);
    expect(sql).not.toMatch(/FROM resumes a/i);
    expect(sql).not.toMatch(/SELECT[\s\S]*r\.file_path[\s\S]*FROM resumes a/i);
  });

  it("returns mapped row when a duplicate hash exists", async () => {
    pool.query.mockResolvedValue({
      rows: [
        {
          resume_id: "resume-1",
          parsed_resume_id: "parsed-1",
          parsed_json: { name: "Jane", skills: ["node"] },
          file_path: "user/hash.pdf",
        },
      ],
    });

    const result = await findResumeByHash("hash", "user-1");

    expect(result).toEqual({
      resumeId: "resume-1",
      parsedResumeId: "parsed-1",
      parsedJson: { name: "Jane", skills: ["node"] },
      filePath: "user/hash.pdf",
    });
    expect(pool.query).toHaveBeenCalledWith(expect.any(String), ["hash", "user-1"]);
  });

  it("rethrows and logs on SQL failure", async () => {
    const pgErr = Object.assign(new Error("syntax error"), { code: "42601" });
    pool.query.mockRejectedValue(pgErr);

    await expect(findResumeByHash("hash", "user-1")).rejects.toThrow("syntax error");
    const { logError } = require("../src/utils/logger");
    expect(logError).toHaveBeenCalledWith(
      "find_resume_by_hash_failed",
      pgErr,
      expect.objectContaining({ fileHash: "hash", userId: "user-1" })
    );
  });
});
