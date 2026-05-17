jest.mock("../src/services/jobHandler", () => ({
  processResumeJob: jest.fn(),
}));

jest.mock("../src/models/resumeModel", () => ({
  findResumeByHash: jest.fn(),
}));

jest.mock("../src/config/supabase", () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: jest.fn().mockResolvedValue({ error: null }),
      }),
    },
  },
}));

const { findResumeByHash } = require("../src/models/resumeModel");
const { uploadResumeController } = require("../src/controllers/resumeController");

describe("uploadResumeController catch handling", () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  const baseReq = {
    requestId: "req-1",
    user: { id: "user-1" },
    file: {
      buffer: Buffer.from("%PDF-1.4 test"),
      mimetype: "application/pdf",
      size: 128,
      originalname: "resume.pdf",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns JSON error when findResumeByHash throws (no secondary TypeError)", async () => {
    const pgErr = Object.assign(new Error('missing FROM-clause entry for table "r"'), {
      code: "42P01",
    });
    findResumeByHash.mockRejectedValue(pgErr);

    const res = mockRes();
    await uploadResumeController(baseReq, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining("Processing error"),
        code: "INTERNAL_ERROR",
      })
    );
  });

  it("returns cached resume on duplicate hash without re-processing", async () => {
    findResumeByHash.mockResolvedValue({
      resumeId: "existing-id",
      parsedResumeId: "parsed-id",
      parsedJson: { name: "Cached", skills: ["ts"] },
      filePath: "user-1/abc.pdf",
    });

    const res = mockRes();
    await uploadResumeController(baseReq, res);

    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          resumeId: "existing-id",
          message: "Resume retrieved from cache",
        }),
      })
    );
  });
});
