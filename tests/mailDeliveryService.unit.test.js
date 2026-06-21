jest.mock("../src/models/emailAccountModel");
jest.mock("../src/services/oauthTokenService");
jest.mock("../src/services/email/providerRegistry", () => ({ getProvider: jest.fn() }));
jest.mock("../src/services/mailService", () => ({ fetchSmtpCredentials: jest.fn() }));

const emailAccountModel = require("../src/models/emailAccountModel");
const oauthTokenService = require("../src/services/oauthTokenService");
const { getProvider } = require("../src/services/email/providerRegistry");
const { fetchSmtpCredentials } = require("../src/services/mailService");
const mailDeliveryService = require("../src/services/email/mailDeliveryService");

const MESSAGE = { to: "r@corp.com", subject: "Hi", text: "Body", attachments: [] };

describe("mailDeliveryService.resolveSendingAccount", () => {
  beforeEach(() => jest.clearAllMocks());

  it("prefers a connected Gmail account that can send", async () => {
    emailAccountModel.getByUserAndProvider.mockResolvedValue({
      id: "acc-1",
      status: "connected",
      can_send: true,
      email_address: "me@gmail.com",
    });
    const resolved = await mailDeliveryService.resolveSendingAccount("u1");
    expect(resolved.type).toBe("gmail");
    expect(fetchSmtpCredentials).not.toHaveBeenCalled();
  });

  it("falls back to SMTP when no usable Gmail account exists", async () => {
    emailAccountModel.getByUserAndProvider.mockResolvedValue(null);
    fetchSmtpCredentials.mockResolvedValue({ email: "me@gmail.com", password: "apppass" });
    const resolved = await mailDeliveryService.resolveSendingAccount("u1");
    expect(resolved).toEqual({ type: "smtp", credentials: { email: "me@gmail.com", password: "apppass" } });
  });

  it("does not use a revoked Gmail account (falls back to SMTP)", async () => {
    emailAccountModel.getByUserAndProvider.mockResolvedValue({
      id: "acc-1",
      status: "revoked",
      can_send: true,
    });
    fetchSmtpCredentials.mockResolvedValue({ email: "x@gmail.com", password: "p" });
    const resolved = await mailDeliveryService.resolveSendingAccount("u1");
    expect(resolved.type).toBe("smtp");
  });

  it("uses SMTP only when the Gmail sending kill switch is off (SMTP path unchanged)", async () => {
    const config = require("../src/config");
    const original = config.google.sendingEnabled;
    config.google.sendingEnabled = false;
    try {
      fetchSmtpCredentials.mockResolvedValue({ email: "x@gmail.com", password: "p" });
      const resolved = await mailDeliveryService.resolveSendingAccount("u1");
      expect(resolved.type).toBe("smtp");
      // Gmail account is never even looked up when the switch is off.
      expect(emailAccountModel.getByUserAndProvider).not.toHaveBeenCalled();
    } finally {
      config.google.sendingEnabled = original;
    }
  });
});

describe("mailDeliveryService.send", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sends via Gmail, refreshes token, and touches last_used_at", async () => {
    emailAccountModel.getByUserAndProvider.mockResolvedValue({
      id: "acc-1",
      status: "connected",
      can_send: true,
      email_address: "me@gmail.com",
    });
    oauthTokenService.getFreshAccessToken.mockResolvedValue({ accessToken: "AT" });
    const sendEmail = jest
      .fn()
      .mockResolvedValue({ providerMessageId: "m1", threadId: "t1", raw: {} });
    getProvider.mockReturnValue({ sendEmail });

    const result = await mailDeliveryService.send("u1", MESSAGE);

    expect(oauthTokenService.getFreshAccessToken).toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledWith(
      { accessToken: "AT", emailAddress: "me@gmail.com" },
      expect.objectContaining({ from: "me@gmail.com", to: "r@corp.com" })
    );
    expect(emailAccountModel.touchLastUsed).toHaveBeenCalledWith("acc-1");
    expect(result).toMatchObject({
      provider: "gmail",
      providerMessageId: "m1",
      threadId: "t1",
      accountId: "acc-1",
    });
  });

  it("degrades health and tags the account id when a Gmail send fails", async () => {
    emailAccountModel.getByUserAndProvider.mockResolvedValue({
      id: "acc-1",
      status: "connected",
      can_send: true,
      email_address: "me@gmail.com",
    });
    oauthTokenService.getFreshAccessToken.mockResolvedValue({ accessToken: "AT" });
    emailAccountModel.markHealth.mockResolvedValue({});
    getProvider.mockReturnValue({
      sendEmail: jest.fn().mockRejectedValue(new Error("gmail 500")),
    });

    await expect(mailDeliveryService.send("u1", MESSAGE)).rejects.toMatchObject({
      emailAccountId: "acc-1",
    });
    expect(emailAccountModel.markHealth).toHaveBeenCalledWith("acc-1", "degraded", "gmail 500");
  });

  it("sends via SMTP fallback", async () => {
    emailAccountModel.getByUserAndProvider.mockResolvedValue(null);
    fetchSmtpCredentials.mockResolvedValue({ email: "me@gmail.com", password: "apppass" });
    const sendEmail = jest.fn().mockResolvedValue({ providerMessageId: "smtp-1", threadId: null });
    getProvider.mockReturnValue({ sendEmail });

    const result = await mailDeliveryService.send("u1", MESSAGE);

    expect(sendEmail).toHaveBeenCalledWith(
      { user: "me@gmail.com", pass: "apppass" },
      expect.objectContaining({ from: "me@gmail.com" })
    );
    expect(result).toMatchObject({ provider: "smtp", providerMessageId: "smtp-1", threadId: null });
  });
});
