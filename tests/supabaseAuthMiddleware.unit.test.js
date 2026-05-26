const supabaseAuthMiddleware = require("../src/middlewares/supabaseAuthMiddleware");

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe("supabaseAuthMiddleware", () => {
  it("returns MISSING_AUTH_HEADER when Authorization is absent", async () => {
    const req = { headers: {}, requestId: "r1", originalUrl: "/api/user/me" };
    const res = mockRes();
    const next = jest.fn();

    await supabaseAuthMiddleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe("MISSING_AUTH_HEADER");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns MALFORMED_AUTH_HEADER when scheme is not Bearer", async () => {
    const req = {
      headers: { authorization: "Basic abc" },
      requestId: "r1",
      originalUrl: "/api/user/me",
    };
    const res = mockRes();
    const next = jest.fn();

    await supabaseAuthMiddleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe("MALFORMED_AUTH_HEADER");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns MISSING_AUTH_TOKEN when Bearer token is empty", async () => {
    const req = {
      headers: { authorization: "Bearer " },
      requestId: "r1",
      originalUrl: "/api/user/me",
    };
    const res = mockRes();
    const next = jest.fn();

    await supabaseAuthMiddleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe("MISSING_AUTH_TOKEN");
    expect(next).not.toHaveBeenCalled();
  });
});
