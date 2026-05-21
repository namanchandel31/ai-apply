const { sanitizeEmailOutput } = require("../src/utils/emailSanitize");

describe("emailSanitize", () => {
  it("replaces em dash and strips markdown", () => {
    const out = sanitizeEmailOutput({
      subject: "Role",
      body: "Hi — I am **excited** about the role.",
    });
    expect(out.body).not.toMatch(/—/);
    expect(out.body).not.toContain("**");
  });

  it("collapses double spaces", () => {
    const out = sanitizeEmailOutput({
      subject: "Role",
      body: "Hello  world",
    });
    expect(out.body).toBe("Hello world");
  });
});
