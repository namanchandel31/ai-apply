const { sendError } = require("../src/utils/httpErrorResponse");

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((body) => {
    res.body = body;
    return res;
  });
  return res;
}

describe("sendError", () => {
  it("returns nested error shape", () => {
    const res = mockRes();
    sendError(res, {
      status: 409,
      code: "RETRY_ALREADY_IN_FLIGHT",
      message: "A retry is already in progress",
      retryable: false,
    });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: "RETRY_ALREADY_IN_FLIGHT",
        message: "A retry is already in progress",
        retryable: false,
      },
    });
  });

  it("includes meta when provided", () => {
    const res = mockRes();
    sendError(res, {
      status: 503,
      code: "SERVICE_UNAVAILABLE",
      message: "Unavailable",
      retryable: true,
      meta: { attempt: 2 },
    });
    expect(res.body.error.meta).toEqual({ attempt: 2 });
  });
});
