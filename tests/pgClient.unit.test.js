const EventEmitter = require("events");
const { attachPgClientErrorHandler } = require("../src/db/pgClient");

jest.mock("../src/utils/logger", () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
}));

describe("attachPgClientErrorHandler", () => {
  it("attaches listener only once per client", () => {
    const client = new EventEmitter();
    client.release = () => {};
    attachPgClientErrorHandler(client);
    attachPgClientErrorHandler(client);
    expect(client.__pgErrorHandlerAttached).toBe(true);
    expect(client.listenerCount("error")).toBe(1);
  });
});
