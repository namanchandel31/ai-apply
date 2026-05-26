const {
  isEmailVerifiedFromClaims,
  extractProfileFromClaims,
  hasOAuthAuthenticationMethod,
  audienceMatches,
  authReasonToResponseCode,
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

  it("accepts OAuth via amr when app_metadata is absent from access token", () => {
    expect(
      isEmailVerifiedFromClaims({
        email: "user@gmail.com",
        role: "authenticated",
        amr: [{ method: "oauth", timestamp: 1710000000 }],
      })
    ).toBe(true);
  });

  it("accepts user_metadata.email_verified", () => {
    expect(
      isEmailVerifiedFromClaims({
        user_metadata: { email_verified: true },
      })
    ).toBe(true);
  });

  it("rejects unverified email/password style tokens", () => {
    expect(
      isEmailVerifiedFromClaims({
        email_verified: false,
        app_metadata: { provider: "email" },
        amr: [{ method: "password", timestamp: 1710000000 }],
      })
    ).toBe(false);
    expect(isEmailVerifiedFromClaims({ email: "a@b.com" })).toBe(false);
  });
});

describe("hasOAuthAuthenticationMethod", () => {
  it("detects oauth in amr objects and strings", () => {
    expect(hasOAuthAuthenticationMethod({ amr: [{ method: "oauth" }] })).toBe(true);
    expect(hasOAuthAuthenticationMethod({ amr: ["oauth"] })).toBe(true);
    expect(hasOAuthAuthenticationMethod({ amr: [{ method: "password" }] })).toBe(false);
  });
});

describe("audienceMatches", () => {
  it("matches string and array aud claims", () => {
    expect(audienceMatches({ aud: "authenticated" }, "authenticated")).toBe(true);
    expect(audienceMatches({ aud: ["authenticated"] }, "authenticated")).toBe(true);
    expect(audienceMatches({ aud: "anon" }, "authenticated")).toBe(false);
  });
});

describe("authReasonToResponseCode", () => {
  it("maps verification failures to API codes", () => {
    expect(authReasonToResponseCode("wrong_issuer")).toBe("INVALID_ISSUER");
    expect(authReasonToResponseCode("wrong_audience")).toBe("INVALID_AUDIENCE");
    expect(authReasonToResponseCode("jwks_fetch_failed")).toBe("JWKS_FETCH_FAILED");
    expect(authReasonToResponseCode("expired")).toBe("TOKEN_EXPIRED");
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
