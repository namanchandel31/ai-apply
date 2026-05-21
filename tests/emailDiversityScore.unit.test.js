const { scoreDiversityFingerprint } = require("../src/services/emailDiversityScore");

describe("scoreDiversityFingerprint", () => {
  it("produces different fingerprints for different structures", () => {
    const a = scoreDiversityFingerprint({
      body: "Hi Sarah,\n\nShort opener.\n\nLonger second paragraph with more detail about the role and my background in building systems.\n\nThanks,\nJane",
    });
    const b = scoreDiversityFingerprint({
      body: "I am writing regarding the role.\n\nOne block only with all details combined.",
    });
    expect(a.cadenceFingerprint).not.toBe(b.cadenceFingerprint);
    expect(a.openerPattern).not.toBe(b.openerPattern);
  });
});
