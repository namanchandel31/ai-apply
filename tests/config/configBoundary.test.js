const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

describe("config boundary", () => {
  it("src/ does not read process.env outside config/", () => {
    const root = path.join(__dirname, "../../src");
    const configDir = path.join(root, "config");
    const offenders = [];

    function walk(dir) {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) {
          if (name === "config") continue;
          walk(full);
          continue;
        }
        if (!name.endsWith(".js")) continue;
        const rel = path.relative(root, full);
        if (rel === "bootstrap.js") continue;
        const content = fs.readFileSync(full, "utf8");
        if (content.includes("process.env")) {
          offenders.push(rel);
        }
      }
    }

    walk(root);
    expect(offenders).toEqual([]);
  });
});
