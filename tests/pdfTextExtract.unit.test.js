const fs = require("fs");
const path = require("path");
const {
  unescapePdfLiteralString,
  extractActualTextFromPdfBuffer,
  extractTextFromPdf,
} = require("../src/utils/pdfTextExtract");

describe("pdfTextExtract", () => {
  it("unescapes PDF octal and named escapes", () => {
    expect(unescapePdfLiteralString("hello\\040world")).toBe("hello world");
    expect(unescapePdfLiteralString("a\\054b")).toBe("a,b");
    expect(unescapePdfLiteralString("line1\\nline2")).toBe("line1\nline2");
  });

  it("extracts ActualText from tagged PDF fixtures when present", async () => {
    const fixturePath = path.join("c:/Users/naman/Desktop/Rachel_Chen_Resume.pdf");
    if (!fs.existsSync(fixturePath)) {
      return;
    }

    const buffer = fs.readFileSync(fixturePath);
    const actualText = extractActualTextFromPdfBuffer(buffer);
    expect(actualText.length).toBeGreaterThan(500);
    expect(actualText).toMatch(/Rachel Chen/i);
    expect(actualText).toMatch(/EXPERIENCE/i);

    const extracted = await extractTextFromPdf(buffer);
    expect(extracted.method).toBe("actual-text");
    expect(extracted.sanitized.length).toBeGreaterThan(500);
  });
});
