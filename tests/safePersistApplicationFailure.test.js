jest.mock("../src/services/transitionJobState", () => ({
  transitionJobState: jest.fn(),
}));
jest.mock("../src/services/transitionApplicationState", () => ({
  transitionApplicationState: jest.fn(),
}));

const { transitionJobState } = require("../src/services/transitionJobState");
const { transitionApplicationState } = require("../src/services/transitionApplicationState");
const { safePersistApplicationFailure } = require("../src/services/safePersistApplicationFailure");

describe("safePersistApplicationFailure", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    transitionJobState.mockResolvedValue({ ok: true });
    transitionApplicationState.mockResolvedValue({ ok: true });
  });

  it("persists job and application failure", async () => {
    await safePersistApplicationFailure(
      {},
      {
        applicationId: "app-1",
        userId: "user-1",
        jobId: "job-1",
        lastError: "boom",
        failureStage: "ai_process",
      }
    );
    expect(transitionJobState).toHaveBeenCalled();
    expect(transitionApplicationState).toHaveBeenCalled();
  });

  it("does not throw when persistence fails", async () => {
    transitionApplicationState.mockRejectedValue(new Error("db down"));
    await expect(
      safePersistApplicationFailure(
        {},
        {
          applicationId: "app-1",
          jobId: "job-1",
        }
      )
    ).resolves.toBeUndefined();
  });
});
