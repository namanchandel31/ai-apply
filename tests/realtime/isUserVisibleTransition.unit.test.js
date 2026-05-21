const {
  isPublishWorthy,
  isVisibleUiStatus,
} = require("../../src/realtime/isUserVisibleTransition");

describe("isUserVisibleTransition", () => {
  it("recognizes visible ui statuses", () => {
    expect(isVisibleUiStatus("processing")).toBe(true);
    expect(isVisibleUiStatus("draft")).toBe(false);
  });

  it("skips publish when version unchanged and visible ui unchanged", () => {
    const worthy = isPublishWorthy(
      { version: 3, epoch: 0 },
      { uiStatus: "processing", status: "draft" },
      { version: 3, epoch: 0, uiStatus: "processing", status: "draft" },
      {}
    );
    expect(worthy).toBe(false);
  });

  it("allows publish when version moves", () => {
    const worthy = isPublishWorthy(
      { version: 4, epoch: 0 },
      { uiStatus: "processing", status: "draft" },
      { version: 3, epoch: 0, uiStatus: "processing" },
      {}
    );
    expect(worthy).toBe(true);
  });
});
