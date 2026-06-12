const {
  prepareResumeText,
  assertUsableResumeText,
  buildTextFromParsedResume,
  MIN_RESUME_CHARS,
} = require("../src/services/certificationResumeInput");
const { NonRetryableError } = require("../src/utils/errors");

describe("certificationResumeInput", () => {
  const longResume = "A".repeat(MIN_RESUME_CHARS + 10);

  it("prepareResumeText returns a string (not an object wrapper)", () => {
    const text = prepareResumeText(longResume);
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThanOrEqual(MIN_RESUME_CHARS);
  });

  it("assertUsableResumeText accepts valid text", () => {
    expect(assertUsableResumeText(longResume, { source: "test" })).toBe(longResume);
  });

  it("assertUsableResumeText rejects empty content", () => {
    expect(() => assertUsableResumeText("", { source: "test" })).toThrow(NonRetryableError);
    expect(() => assertUsableResumeText("", { source: "test" })).toThrow(/empty/i);
  });

  it("assertUsableResumeText rejects text shorter than minimum", () => {
    expect(() => assertUsableResumeText("short", { source: "test" })).toThrow(NonRetryableError);
    expect(() => assertUsableResumeText("short", { source: "test" })).toThrow(/extraction failed/i);
  });

  it("assertUsableResumeText does not crash on undefined", () => {
    expect(() => assertUsableResumeText(undefined, { source: "test" })).toThrow(/empty/i);
  });

  it("buildTextFromParsedResume handles missing fields", () => {
    expect(buildTextFromParsedResume(undefined)).toBe("");
    expect(buildTextFromParsedResume({})).toBe("");
  });

  it("buildTextFromParsedResume builds text from parsed resume", () => {
    const text = buildTextFromParsedResume({
      name: "Jane Doe",
      email: "jane@example.com",
      skills: ["JavaScript", "React"],
      experience: [{ role: "Engineer", company: "Acme", description: "Built apps" }],
      education: [{ degree: "BS CS", institution: "State U", graduation_year: "2020" }],
      summary: "Experienced developer with a passion for quality software.",
    });
    expect(text).toContain("Jane Doe");
    expect(text).toContain("JavaScript");
    expect(text.length).toBeGreaterThanOrEqual(MIN_RESUME_CHARS);
  });

  it("buildTextFromParsedResume handles empty skills array", () => {
    const text = buildTextFromParsedResume({
      name: "Jane Doe",
      email: "jane@example.com",
      summary: "x".repeat(MIN_RESUME_CHARS),
      skills: [],
    });
    expect(text.length).toBeGreaterThanOrEqual(MIN_RESUME_CHARS);
  });
});
