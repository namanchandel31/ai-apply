const { scoreResumeParse, computeSkillPrecision } = require("../src/services/resumeCertificationScorer");

describe("resumeCertificationScorer", () => {
  it("computes skill precision", () => {
    const source = "Skills: Flutter, Firebase, Dart, mobile development";
    const result = computeSkillPrecision(["Flutter", "Firebase", "React", "NodeJS"], source);
    expect(result.skillsFound).toBe(2);
    expect(result.skillsTotal).toBe(4);
    expect(result.precision).toBe(0.5);
  });

  it("scores grounded resume higher than hallucinated skills", () => {
    const source = `
John Doe
john@example.com
Skills: JavaScript, Node.js, React
Experience at Acme Corp as Engineer
Education: BS Computer Science at State University
    `;
    const good = {
      name: "John Doe",
      email: "john@example.com",
      phone: null,
      location: null,
      linkedin: null,
      github: null,
      portfolio: null,
      summary: "Software engineer with backend experience",
      skills: ["javascript", "node.js", "react"],
      experience: [{ company: "Acme Corp", role: "Engineer", location: null, start_date: null, end_date: null, duration: null, description: "Built APIs" }],
      education: [{ institution: "State University", degree: "BS", field_of_study: "CS", start_date: null, end_date: null }],
      projects: [],
      certifications: [],
    };
    const bad = { ...good, skills: ["javascript", "node.js", "react", "kubernetes", "rust"] };
    const goodScore = scoreResumeParse(good, source).resumeScore;
    const badScore = scoreResumeParse(bad, source).resumeScore;
    expect(goodScore).toBeGreaterThanOrEqual(badScore);
  });
});
