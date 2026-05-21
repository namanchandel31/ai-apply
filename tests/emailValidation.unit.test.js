const { validateGeneratedEmail } = require("../src/services/emailValidation");

const baseContext = {
  job: { title: "Engineer", company: "Acme" },
  candidate: { skills: ["react"] },
  allowedTools: ["react", "node"],
};

describe("validateGeneratedEmail", () => {
  it("soft-bans mild cadence issues without mandatory retry", () => {
    const body = [
      "Hi team,",
      "",
      "I noticed you're hiring for Engineer at Acme. Most of my recent work has been react and node shipping features for internal tools and customer-facing apps.",
      "",
      "At my last role I owned pieces of the stack end to end, paired with design on scope, and kept releases moving without much ceremony. That maps cleanly to what you describe in the posting.",
      "",
      "I've attached my resume. Happy to chat this week if useful.",
      "",
      "Best,",
      "Jane",
    ].join("\n");

    const result = validateGeneratedEmail(
      { subject: "Engineer role at Acme", body },
      baseContext
    );
    expect(result.hardFailures).not.toContain("severe_genericity:opening");
    expect(result.compositeRisk).toBeLessThan(70);
  });

  it("hard-fails em dash and markdown", () => {
    const result = validateGeneratedEmail(
      {
        subject: "Hello",
        body: "Hi — I am **excited** to apply for the Engineer role at Acme with react experience spanning multiple years of building products and shipping code regularly for teams.",
      },
      baseContext
    );
    expect(result.hardFailures).toEqual(
      expect.arrayContaining(["ai_punctuation:em_en_dash", "markdown_leakage"])
    );
  });

  it("hard-fails severe generic opening", () => {
    const result = validateGeneratedEmail(
      {
        subject: "Application",
        body: [
          "Dear Hiring Manager, I am excited to apply and I am writing to express my strong interest. I believe my skills align well with your needs and I am passionate about this opportunity.",
          "",
          "Thank you for your consideration.",
        ].join("\n"),
      },
      baseContext
    );
    expect(result.hardFailures).toContain("severe_genericity:opening");
  });
});
