const {
  buildQueryConfig,
  execQuery,
  wrapPoolQuery,
  sqlHash,
  paramCountForConfig,
} = require("../src/db/queryInstrumentation");

describe("queryInstrumentation", () => {
  it("buildQueryConfig clones values and strips name", () => {
    const values = [1, 2];
    const config = buildQueryConfig(
      { name: "status_query", text: "SELECT $1, $2", values },
      undefined
    );
    expect(config.name).toBeUndefined();
    expect(config.values).toEqual([1, 2]);
    expect(config.values).not.toBe(values);
    values.push(3);
    expect(config.values).toEqual([1, 2]);
  });

  it("buildQueryConfig from string + array", () => {
    const config = buildQueryConfig("SELECT $1", ["a"]);
    expect(config.text).toBe("SELECT $1");
    expect(config.values).toEqual(["a"]);
    expect(config.name).toBeUndefined();
  });

  it("execQuery does not mutate original values array", async () => {
    const values = ["id-1", "user-1"];
    const query = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const target = { query };
    await execQuery(target, "SELECT $1, $2", values);
    const passed = query.mock.calls[0][0];
    expect(passed.values).toEqual(["id-1", "user-1"]);
    expect(passed.values).not.toBe(values);
    expect(passed.name).toBeUndefined();
  });

  it("wrapPoolQuery forwards callback without treating it as values", (done) => {
    const pool = {
      query: jest.fn((config, cb) => {
        expect(Array.isArray(config.values)).toBe(true);
        expect(config.values).toHaveLength(1);
        expect(config.name).toBeUndefined();
        cb(null, { rows: [{ ok: 1 }], rowCount: 1 });
      }),
    };
    wrapPoolQuery(pool);
    pool.query("SELECT $1", ["only-one"], (err, res) => {
      expect(err).toBeNull();
      expect(res.rows[0].ok).toBe(1);
      done();
    });
  });

  it("wrapPoolQuery is not applied twice", () => {
    const pool = { query: jest.fn() };
    wrapPoolQuery(pool);
    const first = pool.query;
    wrapPoolQuery(pool);
    expect(pool.query).toBe(first);
  });

  it("sqlHash is stable", () => {
    expect(sqlHash("SELECT 1")).toBe(sqlHash("SELECT 1"));
    expect(sqlHash("SELECT 1")).not.toBe(sqlHash("SELECT 2"));
  });

  it("paramCountForConfig counts placeholders values", () => {
    expect(paramCountForConfig({ text: "x", values: [1, 2] })).toBe(2);
    expect(paramCountForConfig({ text: "x" })).toBe(0);
  });
});
