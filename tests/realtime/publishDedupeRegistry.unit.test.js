const {
  shouldEmitPublish,
  recordEmitted,
  publishKey,
  resetPublishDedupeForTests,
} = require("../../src/realtime/publishDedupeRegistry");

describe("publishDedupeRegistry", () => {
  beforeEach(() => {
    resetPublishDedupeForTests();
  });

  it("allows first emit per applicationId+version+epoch+uiStatus", () => {
    const meta = {
      applicationId: "app-1",
      version: 2,
      orchestrationEpoch: 0,
      uiStatus: "generated",
      publishSource: "test",
    };
    expect(shouldEmitPublish(meta).allow).toBe(true);
    recordEmitted(publishKey("app-1", 2, 0, "generated"), {
      eventId: "e1",
      publishSource: "test",
    });
    expect(shouldEmitPublish(meta).allow).toBe(false);
  });

  it("allows different uiStatus at same version", () => {
    recordEmitted(publishKey("app-1", 2, 0, "generated"), {});
    const next = shouldEmitPublish({
      applicationId: "app-1",
      version: 2,
      orchestrationEpoch: 0,
      uiStatus: "queued_sending",
      publishSource: "test",
    });
    expect(next.allow).toBe(true);
  });

  it("allows higher version for same application", () => {
    recordEmitted(publishKey("app-1", 1, 0, "processing"), {});
    const next = shouldEmitPublish({
      applicationId: "app-1",
      version: 2,
      orchestrationEpoch: 0,
      publishSource: "test",
    });
    expect(next.allow).toBe(true);
  });
});
