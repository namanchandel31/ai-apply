const { fallbackExtractTitle } = require("../src/services/jdTitleHeuristics");

describe("jdTitleHeuristics", () => {
  it("extracts from hiring for line", () => {
    const r = fallbackExtractTitle("We're hiring for Flutter Developers. Bangalore.");
    expect(r?.title).toBe("Flutter Developer");
  });

  it("extracts from job title label", () => {
    const r = fallbackExtractTitle("Job Title: Senior Node.js Developer\nRemote");
    expect(r?.title).toMatch(/Node\.js Developer/i);
  });
});
