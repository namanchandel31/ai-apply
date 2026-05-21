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
    publishSource: "unit_test",
  };

  it("blocks duplicate triple within TTL", () => {
    expect(shouldEmitPublish(base).allow).toBe(true);
    recordEmitted(publishKey(base.applicationId, base.version, base.orchestrationEpoch), {});
    expect(shouldEmitPublish(base).allow).toBe(false);
  });

  it("allows same app with bumped version", () => {
    recordEmitted(publishKey(base.applicationId, 2, 1), {});
    expect(
      shouldEmitPublish({ ...base, version: 3 }).allow
    ).toBe(true);
  });
});
