const {
  isEmailVerifiedFromClaims,
  extractProfileFromClaims,
} = require("../src/services/supabaseJwtVerifier");

describe("isEmailVerifiedFromClaims", () => {
  it("accepts email_verified true", () => {
    expect(isEmailVerifiedFromClaims({ email_verified: true })).toBe(true);
  });

  it("accepts email_confirmed_at for Google OAuth style tokens", () => {
    expect(
      isEmailVerifiedFromClaims({
        email_confirmed_at: "2026-05-26T12:00:00.000Z",
        app_metadata: { provider: "google" },
      })
    ).toBe(true);
  });

  it("accepts known OAuth providers without email_confirmed_at", () => {
    expect(
      isEmailVerifiedFromClaims({
        app_metadata: { provider: "google" },
      })
    ).toBe(true);
    expect(
      isEmailVerifiedFromClaims({
        app_metadata: { providers: ["github"] },
      })
    ).toBe(true);
  });

  it("rejects unverified email/password style tokens", () => {
    expect(
      isEmailVerifiedFromClaims({
        email_verified: false,
        app_metadata: { provider: "email" },
      })
    ).toBe(false);
    expect(isEmailVerifiedFromClaims({ email: "a@b.com" })).toBe(false);
  });
});

describe("extractProfileFromClaims", () => {
  it("reads email from payload and metadata", () => {
    expect(
      extractProfileFromClaims({
        email: "user@gmail.com",
        user_metadata: { full_name: "Test", avatar_url: "https://x/a.png" },
      })
    ).toEqual({
      email: "user@gmail.com",
      fullName: "Test",
      avatarUrl: "https://x/a.png",
    });
  });
});
