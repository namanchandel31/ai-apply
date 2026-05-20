const { execSync } = require("child_process");
const path = require("path");

describe("circular dependencies", () => {
  it("has no circular imports under src/", () => {
    const root = path.join(__dirname, "../..");
    let output = "";
    let status = 0;
    try {
      output = execSync("npx madge --circular src", {
        cwd: root,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err) {
      status = err.status ?? 1;
      output = `${err.stdout || ""}${err.stderr || ""}`;
    }

    const hasCycleListing =
      /\d+\) >/.test(output) ||
      /Circular dependency/i.test(output) ||
      /Found \d+ circular/i.test(output);

    if (status !== 0 || hasCycleListing) {
      throw new Error(`Circular dependencies detected:\n${output}`);
    }

    expect(hasCycleListing).toBe(false);
  });
});
