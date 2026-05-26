const { isSpaFallbackRoute, SPA_FALLBACK_PATTERN } = require("../src/utils/spaFallback");

describe("SPA fallback routing", () => {
  describe("isSpaFallbackRoute", () => {
    it("matches client-side routes without file extensions", () => {
      expect(isSpaFallbackRoute("/")).toBe(true);
      expect(isSpaFallbackRoute("/settings")).toBe(true);
      expect(isSpaFallbackRoute("/apply/step-2")).toBe(true);
      expect(isSpaFallbackRoute("/auth/callback")).toBe(true);
    });

    it("does not match API, health, or docs paths", () => {
      expect(isSpaFallbackRoute("/api/upload-resume")).toBe(false);
      expect(isSpaFallbackRoute("/api/apply")).toBe(false);
      expect(isSpaFallbackRoute("/health")).toBe(false);
      expect(isSpaFallbackRoute("/docs")).toBe(false);
      expect(isSpaFallbackRoute("/openapi.json")).toBe(false);
    });

    it("does not match paths with file extensions (missing static assets must 404)", () => {
      expect(isSpaFallbackRoute("/assets/index-abc123.js")).toBe(false);
      expect(isSpaFallbackRoute("/assets/missing.css")).toBe(false);
      expect(isSpaFallbackRoute("/favicon.ico")).toBe(false);
      expect(isSpaFallbackRoute("/vite.svg")).toBe(false);
      expect(isSpaFallbackRoute("/js/app.js")).toBe(false);
    });
  });

  it("exports a RegExp compatible with Express app.get", () => {
    expect(SPA_FALLBACK_PATTERN).toBeInstanceOf(RegExp);
  });
});
