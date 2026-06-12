const {
  resolveResumeForAutoApply,
} = require("../src/services/resolveResumeForAutoApply");

jest.mock("../src/models/userModel", () => ({
  getUserDefaults: jest.fn(),
}));

jest.mock("../src/models/resumeModel", () => ({
  getResumeById: jest.fn(),
  getLatestParsedResumeForUser: jest.fn(),
}));

const { getUserDefaults } = require("../src/models/userModel");
const { getResumeById, getLatestParsedResumeForUser } = require("../src/models/resumeModel");

describe("resolveResumeForAutoApply", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("prefers latest parsed resume over stale default_resume_id", async () => {
    getLatestParsedResumeForUser.mockResolvedValue({
      resumeId: "resume-new",
      parsedResumeId: "pr-new",
      parsedJson: { name: "New" },
      filePath: "user/new.pdf",
    });
    getUserDefaults.mockResolvedValue({ defaultResumeId: "resume-old" });
    getResumeById.mockResolvedValue({
      resumeId: "resume-new",
      parsedResumeId: "pr-new",
      parsedJson: { name: "New" },
      filePath: "user/new.pdf",
    });

    const resolved = await resolveResumeForAutoApply("user-1");

    expect(resolved.resumeId).toBe("resume-new");
    expect(getResumeById).toHaveBeenCalledWith("resume-new", "user-1");
    expect(getUserDefaults).not.toHaveBeenCalled();
  });

  it("uses explicit resumeId when provided", async () => {
    getResumeById.mockResolvedValue({
      resumeId: "resume-explicit",
      parsedResumeId: "pr-explicit",
      parsedJson: { name: "Explicit" },
      filePath: "user/explicit.pdf",
    });

    const resolved = await resolveResumeForAutoApply("user-1", "resume-explicit");

    expect(resolved.resumeId).toBe("resume-explicit");
    expect(getLatestParsedResumeForUser).not.toHaveBeenCalled();
  });
});
