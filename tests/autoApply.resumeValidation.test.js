jest.mock("../src/db", () => ({
  pool: {
    connect: jest.fn(),
    query: jest.fn(),
  },
}));
jest.mock("../src/models/userModel", () => ({ getUserDefaults: jest.fn() }));
jest.mock("../src/models/resumeModel", () => ({
  getResumeById: jest.fn(),
  getLatestParsedResumeForUser: jest.fn(),
}));

const { getUserDefaults } = require("../src/models/userModel");
const { getResumeById, getLatestParsedResumeForUser } = require("../src/models/resumeModel");
const { resolveResumeForAutoApply } = require("../src/services/resolveResumeForAutoApply");

describe("resolveResumeForAutoApply", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws RESUME_REQUIRED when no explicit, default, or latest parsed resume", async () => {
    getUserDefaults.mockResolvedValue({ defaultResumeId: null });
    getLatestParsedResumeForUser.mockResolvedValue(null);

    await expect(resolveResumeForAutoApply("user-1")).rejects.toMatchObject({
      code: "RESUME_REQUIRED",
    });
    expect(getResumeById).not.toHaveBeenCalled();
  });

  it("uses explicit valid resumeId when provided", async () => {
    getResumeById.mockResolvedValue({
      resumeId: "resume-explicit",
      parsedResumeId: "pr-1",
      parsedJson: { name: "A" },
      filePath: "/a.pdf",
    });

    const result = await resolveResumeForAutoApply("user-1", "resume-explicit");

    expect(result.resumeId).toBe("resume-explicit");
    expect(getUserDefaults).not.toHaveBeenCalled();
    expect(getResumeById).toHaveBeenCalledWith("resume-explicit", "user-1");
  });

  it("prefers latest parsed resume over default_resume_id when explicit resumeId omitted", async () => {
    getLatestParsedResumeForUser.mockResolvedValue({
      resumeId: "resume-latest",
      parsedResumeId: "pr-latest",
      parsedJson: { name: "Latest" },
      filePath: "/latest.pdf",
    });
    getUserDefaults.mockResolvedValue({ defaultResumeId: "resume-default" });
    getResumeById.mockResolvedValue({
      resumeId: "resume-latest",
      parsedResumeId: "pr-latest",
      parsedJson: { name: "Latest" },
      filePath: "/latest.pdf",
    });

    const result = await resolveResumeForAutoApply("user-1");

    expect(result.resumeId).toBe("resume-latest");
    expect(getLatestParsedResumeForUser).toHaveBeenCalledWith("user-1");
    expect(getUserDefaults).not.toHaveBeenCalled();
  });

  it("falls back to default resume when no latest parsed resume exists", async () => {
    getLatestParsedResumeForUser.mockResolvedValue(null);
    getUserDefaults.mockResolvedValue({ defaultResumeId: "resume-default" });
    getResumeById.mockResolvedValue({
      resumeId: "resume-default",
      parsedResumeId: "pr-2",
      parsedJson: { name: "B" },
      filePath: "/b.pdf",
    });

    const result = await resolveResumeForAutoApply("user-1");

    expect(result.resumeId).toBe("resume-default");
    expect(getLatestParsedResumeForUser).toHaveBeenCalledWith("user-1");
  });

  it("throws RESUME_NOT_FOUND when resume belongs to another user or is missing", async () => {
    getLatestParsedResumeForUser.mockResolvedValue(null);
    getUserDefaults.mockResolvedValue({ defaultResumeId: "resume-other" });
    getResumeById.mockResolvedValue(null);

    await expect(resolveResumeForAutoApply("user-1")).rejects.toMatchObject({
      code: "RESUME_NOT_FOUND",
    });
  });
});
