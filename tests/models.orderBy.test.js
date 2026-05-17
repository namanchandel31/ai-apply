const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src", "models");

function readModel(name) {
  return fs.readFileSync(path.join(SRC, name), "utf8");
}

describe("nullable ORDER BY consistency", () => {
  it("findResumeByHash uses NULLS LAST", () => {
    const sql = readModel("resumeModel.js");
    const matches = sql.match(/ORDER BY pr\.created_at DESC NULLS LAST/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("getResumeById uses NULLS LAST", () => {
    const sql = readModel("resumeModel.js");
    const getByIdBlock = sql.slice(sql.indexOf("const getResumeById"));
    expect(getByIdBlock).toMatch(/ORDER BY pr\.created_at DESC NULLS LAST/);
    expect(getByIdBlock).not.toMatch(/ORDER BY pr\.created_at DESC\n/);
  });

  it("getJDById uses NULLS LAST", () => {
    const sql = readModel("jdModel.js");
    const getByIdBlock = sql.slice(sql.indexOf("const getJDById"));
    expect(getByIdBlock).toMatch(/ORDER BY pjd\.created_at DESC NULLS LAST/);
    expect(getByIdBlock).not.toMatch(/ORDER BY pjd\.created_at DESC\n/);
  });
});
