const {
  shouldEmitPublish,
  recordEmitted,
  publishKey,
  resetPublishDedupeForTests,
} = require("../src/realtime/publishDedupeRegistry");

describe("publish dedupe (triple key)", () => {
  beforeEach(() => {
    resetPublishDedupeForTests();
  });

  const base = {
    applicationId: "app-dedupe",
    version: 3,
    orchestrationEpoch: 1,
    uiStatus: "generated",
    publishSource: "unit_test",
  };

  it("blocks duplicate triple within TTL", () => {
    expect(shouldEmitPublish(base).allow).toBe(true);
    recordEmitted(
      publishKey(base.applicationId, base.version, base.orchestrationEpoch, base.uiStatus),
      {}
    );
    expect(shouldEmitPublish(base).allow).toBe(false);
  });

  it("allows same app with bumped version", () => {
    recordEmitted(publishKey(base.applicationId, 2, 1, "processing"), {});
    expect(shouldEmitPublish({ ...base, version: 3 }).allow).toBe(true);
  });

  it("allows different uiStatus at same version", () => {
    recordEmitted(publishKey(base.applicationId, 3, 1, "generated"), {});
    expect(
      shouldEmitPublish({ ...base, uiStatus: "queued_sending" }).allow
    ).toBe(true);
  });
});
