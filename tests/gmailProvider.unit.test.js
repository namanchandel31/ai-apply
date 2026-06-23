const mockGenerateAuthUrl = jest.fn(() => "https://accounts.google.com/o/oauth2/v2/auth?x=1");
const mockGetToken = jest.fn();
const mockSetCredentials = jest.fn();
const mockRefresh = jest.fn();
const mockRevoke = jest.fn();
const mockUserinfoGet = jest.fn();
const mockMessagesSend = jest.fn();

jest.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        generateAuthUrl: (...a) => mockGenerateAuthUrl(...a),
        getToken: (...a) => mockGetToken(...a),
        setCredentials: (...a) => mockSetCredentials(...a),
        refreshAccessToken: (...a) => mockRefresh(...a),
        revokeToken: (...a) => mockRevoke(...a),
      })),
    },
    oauth2: jest.fn(() => ({ userinfo: { get: (...a) => mockUserinfoGet(...a) } })),
    gmail: jest.fn(() => ({ users: { messages: { send: (...a) => mockMessagesSend(...a) } } })),
  },
}));

const { GmailProvider, buildRawMime } = require("../src/services/email/providers/GmailProvider");

describe("GmailProvider", () => {
  beforeEach(() => jest.clearAllMocks());

  it("builds a consent URL with offline access, forced consent and incremental auth", () => {
    const provider = new GmailProvider();
    const url = provider.getAuthorizationUrl({
      scopes: ["https://www.googleapis.com/auth/gmail.send"],
      state: "state-123",
      loginHint: "me@gmail.com",
    });
    expect(url).toContain("https://accounts.google.com");
    expect(mockGenerateAuthUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: true,
        scope: ["https://www.googleapis.com/auth/gmail.send"],
        state: "state-123",
        login_hint: "me@gmail.com",
      })
    );
  });

  it("exchanges a code into identity + tokens + granted scopes", async () => {
    mockGetToken.mockResolvedValue({
      tokens: {
        access_token: "AT",
        refresh_token: "RT",
        scope: "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email",
        expiry_date: 1893456000000,
      },
    });
    mockUserinfoGet.mockResolvedValue({ data: { id: "google-sub-1", email: "me@gmail.com" } });

    const provider = new GmailProvider();
    const result = await provider.exchangeCode("auth-code");

    expect(result).toEqual({
      email: "me@gmail.com",
      providerAccountId: "google-sub-1",
      refreshToken: "RT",
      accessToken: "AT",
      expiresAt: new Date(1893456000000),
      grantedScopes: [
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/userinfo.email",
      ],
    });
  });

  it("sends mail via the Gmail API and returns messageId + threadId", async () => {
    mockMessagesSend.mockResolvedValue({ data: { id: "msg-1", threadId: "thread-1" } });

    const provider = new GmailProvider();
    const result = await provider.sendEmail(
      { accessToken: "AT", emailAddress: "me@gmail.com" },
      {
        to: "recruiter@corp.com",
        subject: "Hi",
        text: "Body",
        attachments: [{ filename: "resume.pdf", content: Buffer.from("pdf"), contentType: "application/pdf" }],
      }
    );

    expect(mockMessagesSend).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "me", requestBody: expect.objectContaining({ raw: expect.any(String) }) })
    );
    expect(result).toEqual({
      providerMessageId: "msg-1",
      threadId: "thread-1",
      raw: { id: "msg-1", threadId: "thread-1" },
    });
  });

  it("builds a base64url RFC822 message", async () => {
    const raw = await buildRawMime({
      from: "me@gmail.com",
      to: "you@corp.com",
      subject: "Subject",
      text: "Hello",
    });
    expect(typeof raw).toBe("string");
    expect(raw).not.toMatch(/[+/=]/); // base64url: no +, /, or = padding
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    expect(decoded).toContain("Subject");
    expect(decoded).toContain("you@corp.com");
  });
});
