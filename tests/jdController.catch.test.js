/**
 * Ensures jdController catch block does not shadow the response error helper.
 */
describe("jdController catch shadowing", () => {
  it("catch parameter is named err not error", () => {
    const fs = require("fs");
    const path = require("path");
    const src = fs.readFileSync(
      path.join(__dirname, "../src/controllers/jdController.js"),
      "utf8"
    );
    expect(src).toMatch(/catch\s*\(\s*err\s*\)/);
    expect(src).not.toMatch(/catch\s*\(\s*error\s*\)/);
    expect(src).toContain("sendError");
  });
});
