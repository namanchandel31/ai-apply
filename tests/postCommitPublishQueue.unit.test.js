const {
  enqueuePostCommitPublish,
  markApplicationPublishCommitted,
  flushPostCommitPublishes,
  resetPostCommitQueueForTests,
} = require("../src/realtime/postCommitPublishQueue");

jest.mock("../src/realtime/publishApplicationUpdate", () => ({
  publishApplicationUpdate: jest.fn().mockResolvedValue(undefined),
}));

const { publishApplicationUpdate } = require("../src/realtime/publishApplicationUpdate");

describe("postCommitPublishQueue", () => {
  beforeEach(() => {
    resetPostCommitQueueForTests();
    publishApplicationUpdate.mockClear();
  });

  it("flushes only after mark committed", async () => {
    enqueuePostCommitPublish("app-1", "user-1", { enteringTerminal: true });
    await flushPostCommitPublishes();
    expect(publishApplicationUpdate).not.toHaveBeenCalled();

    markApplicationPublishCommitted("app-1");
    await flushPostCommitPublishes();
    expect(publishApplicationUpdate).toHaveBeenCalledWith(
      "app-1",
      "user-1",
      expect.objectContaining({ enteringTerminal: true })
    );
  });

  it("coalesces duplicate application enqueues", async () => {
    enqueuePostCommitPublish("app-1", "user-1", { forceRevive: false });
    enqueuePostCommitPublish("app-1", "user-1", { forceRevive: true, enteringTerminal: true });
    markApplicationPublishCommitted("app-1");
    await flushPostCommitPublishes();
    expect(publishApplicationUpdate).toHaveBeenCalledTimes(1);
    expect(publishApplicationUpdate.mock.calls[0][2]).toMatchObject({
      forceRevive: true,
      enteringTerminal: true,
    });
  });
});
