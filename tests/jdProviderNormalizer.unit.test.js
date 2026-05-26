const { normalizeProviderPayload } = require("../src/services/jdProviderNormalizer");

describe("jdProviderNormalizer", () => {
  it("normalizes nested provider payloads", () => {
    const { data } = normalizeProviderPayload(
      {
        parsed: {
          title: "Flutter Developer",
          technologies: ["Flutter", "Dart"],
          roles: ["Flutter Developers"],
        },
      },
      { provider: "openai" }
    );
    expect(data.job_title).toBe("Flutter Developer");
    expect(data.skills).toEqual(expect.arrayContaining(["Flutter", "Dart"]));
  });

  it("coerces null strings", () => {
    const { data } = normalizeProviderPayload({ job_title: "null", skills: "none" });
    expect(data.job_title).toBeNull();
  });
});
