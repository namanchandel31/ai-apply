const nodemailer = require("nodemailer");

jest.mock("nodemailer");

const { SmtpProvider } = require("../src/services/email/providers/SmtpProvider");
const { getProvider } = require("../src/services/email/providerRegistry");

describe("SmtpProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends via nodemailer and maps the result to the provider contract", async () => {
    const sendMail = jest.fn().mockResolvedValue({
      messageId: "<abc@gmail.com>",
      accepted: ["recruiter@corp.com"],
    });
    nodemailer.createTransport.mockReturnValue({ sendMail });

    const provider = new SmtpProvider();
    const result = await provider.sendEmail(
      { user: "me@gmail.com", pass: "apppassword1234" },
      {
        to: "recruiter@corp.com",
        subject: "Application",
        text: "Hello",
        attachments: [{ filename: "resume.pdf", content: Buffer.from("x"), contentType: "application/pdf" }],
      }
    );

    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "me@gmail.com",
        to: "recruiter@corp.com",
        subject: "Application",
        text: "Hello",
      })
    );
    expect(result).toEqual({
      providerMessageId: "<abc@gmail.com>",
      threadId: null,
      raw: expect.objectContaining({ messageId: "<abc@gmail.com>" }),
    });
  });

  it("exposes the provider name and is not OAuth", () => {
    const provider = new SmtpProvider();
    expect(provider.name).toBe("smtp");
    expect(provider.isOAuth).toBe(false);
  });
});

describe("providerRegistry", () => {
  it("returns a singleton SmtpProvider for 'smtp'", () => {
    const a = getProvider("smtp");
    const b = getProvider("smtp");
    expect(a).toBe(b);
    expect(a.name).toBe("smtp");
  });

  it("throws for unknown providers", () => {
    expect(() => getProvider("pigeon")).toThrow(/Unknown email provider/);
  });
});
